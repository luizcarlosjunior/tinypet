import { prisma } from "@tinypet/db";
import { normalizeUsername, usernameProblem, type UsernameProblem } from "@tinypet/shared";
import { Errors, ApiError } from "./errors";
import { rateLimit } from "./api";
import { notify } from "./notify";
import { audit } from "./audit";
import { assertLimit } from "./plans";
import { assertReauth, sendReauthCode } from "./reauth";
import { ownerPetCount, type PetActor } from "./pets";

/**
 * Pet sharing & ownership transfer.
 *
 * - One account owns the pet (`Pet.ownerId`); other accounts may have it shared (`PetAccess`, read-only + mark tasks done).
 * - Sharing is by invite (`PetShareInvite`) to an account found by @username or e-mail; the invitee accepts or declines.
 * - The owner removes a share at any time; the shared account leaves at any time.
 * - Ownership can be transferred (`PetOwnershipTransfer`) to a shared account after 7 days of sharing, and only
 *   7 days after the current owner got the pet (`Pet.ownershipSince`, null = since creation → no cooldown).
 *   After a transfer the previous owner becomes a shared account (sharing restarts now).
 * - Invites expire after 14 days, transfers after 7 (lazily, when read or acted on).
 */

// ───────────────────────────── pure rules ─────────────────────────────

export const DAY_MS = 24 * 60 * 60 * 1000;
export const SHARE_MIN_DAYS = 7;
export const OWNERSHIP_COOLDOWN_DAYS = 7;
export const INVITE_TTL_DAYS = 14;
export const TRANSFER_TTL_DAYS = 7;

const addDaysMs = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

/** When the current owner may pass ownership on again; null = already allowed (or never transferred). */
export function ownerCanTransferFrom(ownershipSince: Date | null, now = new Date()): Date | null {
  if (!ownershipSince) return null;
  const at = addDaysMs(ownershipSince, OWNERSHIP_COOLDOWN_DAYS);
  return at.getTime() <= now.getTime() ? null : at;
}

/** Earliest moment ownership can go to a shared account: share start + 7 days, but never before the owner's cooldown. */
export function transferEligibleAt(shareSince: Date, ownershipSince: Date | null): Date {
  const bySharing = addDaysMs(shareSince, SHARE_MIN_DAYS);
  if (!ownershipSince) return bySharing;
  const byCooldown = addDaysMs(ownershipSince, OWNERSHIP_COOLDOWN_DAYS);
  return byCooldown > bySharing ? byCooldown : bySharing;
}

export function canTransferNow(shareSince: Date, ownershipSince: Date | null, now = new Date()): boolean {
  return transferEligibleAt(shareSince, ownershipSince).getTime() <= now.getTime();
}

export function isExpired(row: { expiresAt: Date }, now = new Date()): boolean {
  return row.expiresAt.getTime() <= now.getTime();
}

export type ParsedHandle = { kind: "email"; email: string } | { kind: "username"; username: string };

/** "@joao", "joao" → username; "a@b.com" → e-mail. null when neither is valid. */
export function parseHandle(raw: string): ParsedHandle | null {
  const v = raw.trim();
  if (!v) return null;
  if (!v.startsWith("@") && v.includes("@")) {
    const email = v.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? { kind: "email", email } : null;
  }
  const username = normalizeUsername(v);
  return usernameProblem(username) === "INVALID" ? null : { kind: "username", username };
}

export type UsernameAvailability = { available: true } | { available: false; reason: UsernameProblem | "TAKEN" };

export async function usernameAvailability(raw: string, selfUserId?: string | null): Promise<UsernameAvailability> {
  const u = normalizeUsername(raw);
  const problem = usernameProblem(u);
  if (problem) return { available: false, reason: problem };
  const taken = await prisma.user.findUnique({ where: { username: u }, select: { id: true } });
  if (taken && taken.id !== selfUserId) return { available: false, reason: "TAKEN" };
  return { available: true };
}

/** 409 when `username` belongs to another account. */
export async function assertUsernameFree(username: string, selfUserId?: string) {
  const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (taken && taken.id !== selfUserId) throw Errors.conflict("Este nome de usuário já está em uso. Escolha outro.");
}

// ───────────────────────────── helpers ─────────────────────────────

const userCard = { id: true, name: true, username: true, avatarUrl: true } as const;
type UserCard = { id: string; name: string; username: string | null; avatarUrl: string | null };
const petCard = { id: true, name: true, avatarUrl: true, species: { select: { id: true, key: true, label: true } } } as const;

const NOT_FOUND_ACCOUNT = "Nenhuma conta encontrada com esse usuário ou e-mail.";

/** Marks PENDING invites/transfers past `expiresAt` as EXPIRED (lazy expiry). */
async function expireStale(where: { petId?: string; toUserId?: string }) {
  const now = new Date();
  await Promise.all([
    prisma.petShareInvite.updateMany({ where: { ...where, status: "PENDING", expiresAt: { lte: now } }, data: { status: "EXPIRED" } }),
    prisma.petOwnershipTransfer.updateMany({ where: { ...where, status: "PENDING", expiresAt: { lte: now } }, data: { status: "EXPIRED" } }),
  ]);
}

function assertOwner(actor: PetActor, msg = "Apenas o tutor dono do pet pode gerenciar o compartilhamento") {
  if (actor.via !== "owner") throw Errors.forbidden(msg);
}

function assertAlive(actor: PetActor) {
  if (actor.pet.status === "DECEASED") throw Errors.conflict("Pets em memória não podem ser compartilhados nem transferidos.");
}

const petRoute = (petId: string) => `/pets/${petId}`;

// ───────────────────────────── read ─────────────────────────────

export async function getSharing(actor: PetActor) {
  if (actor.via === "partner") throw Errors.forbidden("Apenas o tutor e as contas compartilhadas veem o compartilhamento");
  const isOwner = actor.via === "owner";
  const me = actor.user.id;
  await expireStale({ petId: actor.pet.id });
  const now = new Date();
  const pet = await prisma.pet.findUniqueOrThrow({
    where: { id: actor.pet.id },
    select: {
      createdAt: true,
      ownershipSince: true,
      owner: { select: userCard },
      accesses: { where: isOwner ? {} : { userId: me }, include: { user: { select: userCard } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!pet.owner) throw Errors.notFound("Este pet não tem tutor");
  const [invites, pendingTransfer] = await Promise.all([
    isOwner
      ? prisma.petShareInvite.findMany({ where: { petId: actor.pet.id, status: "PENDING", expiresAt: { gt: now } }, include: { toUser: { select: userCard } }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    prisma.petOwnershipTransfer.findFirst({
      where: { petId: actor.pet.id, status: "PENDING", expiresAt: { gt: now }, ...(isOwner ? {} : { toUserId: me }) },
      include: { toUser: { select: userCard } },
    }),
  ]);
  return {
    role: isOwner ? ("owner" as const) : ("shared" as const),
    owner: pet.owner,
    ownerSince: (pet.ownershipSince ?? pet.createdAt).toISOString(),
    canTransferFrom: ownerCanTransferFrom(pet.ownershipSince, now)?.toISOString() ?? null,
    shares: pet.accesses.map((a) => ({
      userId: a.userId,
      name: a.user.name,
      username: a.user.username,
      avatarUrl: a.user.avatarUrl,
      since: a.createdAt.toISOString(),
      transferEligibleAt: transferEligibleAt(a.createdAt, pet.ownershipSince).toISOString(),
      canTransferNow: canTransferNow(a.createdAt, pet.ownershipSince, now),
    })),
    invites: invites.map((i) => ({ id: i.id, to: i.toUser, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString() })),
    pendingTransfer: pendingTransfer
      ? { id: pendingTransfer.id, to: pendingTransfer.toUser, createdAt: pendingTransfer.createdAt.toISOString(), expiresAt: pendingTransfer.expiresAt.toISOString() }
      : null,
  };
}

// ───────────────────────────── share invites (owner) ─────────────────────────────

export async function createShareInvite(actor: PetActor, handle: string) {
  assertOwner(actor);
  assertAlive(actor);
  const owner = actor.user;
  // every lookup counts: prevents enumerating accounts by username / e-mail
  await rateLimit(`pet-share-invite:${owner.id}`, 20, 60 * 60 * 1000);
  const parsed = parseHandle(handle);
  if (!parsed) throw Errors.notFound(NOT_FOUND_ACCOUNT);
  const target = await prisma.user.findFirst({
    where: { deletedAt: null, ...(parsed.kind === "email" ? { email: parsed.email } : { username: parsed.username }) },
    select: userCard,
  });
  if (!target) throw Errors.notFound(NOT_FOUND_ACCOUNT);
  if (target.id === owner.id) throw Errors.badRequest("Você já é o tutor deste pet.");
  const petId = actor.pet.id;
  await expireStale({ petId });
  const [already, pending] = await Promise.all([
    prisma.petAccess.findUnique({ where: { petId_userId: { petId, userId: target.id } }, select: { id: true } }),
    prisma.petShareInvite.findFirst({ where: { petId, toUserId: target.id, status: "PENDING" }, select: { id: true } }),
  ]);
  if (already) throw Errors.conflict("Este pet já está compartilhado com essa conta.");
  if (pending) throw Errors.conflict("Já existe um convite pendente para essa conta.");
  const invite = await prisma.petShareInvite.create({
    data: { petId, fromUserId: owner.id, toUserId: target.id, expiresAt: addDaysMs(new Date(), INVITE_TTL_DAYS) },
  });
  await notify({
    userId: target.id,
    type: "pet_share_invite",
    title: `${owner.name} quer compartilhar ${actor.pet.name} com você`,
    body: `Aceite o convite no tinyPet para acompanhar ${actor.pet.name}. O convite vale por ${INVITE_TTL_DAYS} dias.`,
    data: { petId, inviteId: invite.id, route: "/convites" },
    email: true,
  });
  return { id: invite.id, to: target, createdAt: invite.createdAt.toISOString(), expiresAt: invite.expiresAt.toISOString() };
}

export async function cancelShareInvite(actor: PetActor, inviteId: string) {
  assertOwner(actor);
  const res = await prisma.petShareInvite.updateMany({ where: { id: inviteId, petId: actor.pet.id, status: "PENDING" }, data: { status: "CANCELED", respondedAt: new Date() } });
  if (!res.count) throw Errors.notFound("Convite não encontrado");
  return { canceled: true };
}

/** Owner removes a shared account (also cancels a pending transfer to it). */
export async function removeShare(actor: PetActor, userId: string) {
  assertOwner(actor);
  const petId = actor.pet.id;
  const res = await prisma.petAccess.deleteMany({ where: { petId, userId } });
  if (!res.count) throw Errors.notFound("Esta conta não tem o pet compartilhado");
  await prisma.petOwnershipTransfer.updateMany({ where: { petId, toUserId: userId, status: "PENDING" }, data: { status: "CANCELED", respondedAt: new Date() } });
  await notify({
    userId,
    type: "pet_share_removed",
    title: `${actor.user.name} parou de compartilhar ${actor.pet.name} com você`,
    body: `Você não tem mais acesso a ${actor.pet.name}.`,
    data: { petId, route: "/pets" },
  });
  return { removed: true };
}

/** A shared account revokes its own access. */
export async function leavePet(actor: PetActor) {
  if (actor.via === "owner") throw Errors.badRequest("O tutor dono não pode sair do compartilhamento. Transfira a propriedade antes.");
  if (actor.via !== "family") throw Errors.forbidden("Este pet não está compartilhado com você");
  const petId = actor.pet.id;
  await prisma.petAccess.deleteMany({ where: { petId, userId: actor.user.id } });
  await prisma.petOwnershipTransfer.updateMany({ where: { petId, toUserId: actor.user.id, status: "PENDING" }, data: { status: "CANCELED", respondedAt: new Date() } });
  if (actor.pet.ownerId) {
    await notify({
      userId: actor.pet.ownerId,
      type: "pet_share_left",
      title: `${actor.user.name} saiu do compartilhamento de ${actor.pet.name}`,
      body: `${actor.user.name} não tem mais acesso a ${actor.pet.name}.`,
      data: { petId, route: petRoute(petId) },
    });
  }
  return { left: true };
}

// ───────────────────────────── ownership transfers (owner) ─────────────────────────────

export async function createOwnershipTransfer(actor: PetActor, input: { toUserId: string; password?: string | null; code?: string | null }, ip?: string) {
  assertOwner(actor, "Apenas o tutor dono pode transferir a propriedade do pet");
  assertAlive(actor);
  const petId = actor.pet.id;
  await expireStale({ petId });
  const now = new Date();
  const [pet, access, pending] = await Promise.all([
    prisma.pet.findUniqueOrThrow({ where: { id: petId }, select: { ownershipSince: true } }),
    prisma.petAccess.findUnique({ where: { petId_userId: { petId, userId: input.toUserId } }, include: { user: { select: { ...userCard, deletedAt: true } } } }),
    prisma.petOwnershipTransfer.findFirst({ where: { petId, status: "PENDING" }, select: { id: true } }),
  ]);
  if (!access || access.user.deletedAt) throw Errors.badRequest("A propriedade só pode ser transferida para uma conta com quem o pet está compartilhado.");
  if (pending) throw Errors.conflict("Já existe uma transferência pendente para este pet. Cancele-a antes de criar outra.");
  const availableAt = transferEligibleAt(access.createdAt, pet.ownershipSince);
  if (availableAt.getTime() > now.getTime()) {
    throw Errors.badRequest(
      `A transferência para essa conta só fica disponível a partir de ${availableAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
      { reason: "TRANSFER_TOO_EARLY", availableAt: availableAt.toISOString() },
    );
  }
  await assertReauth(actor.user.id, "pet_transfer", { password: input.password, code: input.code });
  const transfer = await prisma.petOwnershipTransfer.create({
    data: { petId, fromUserId: actor.user.id, toUserId: input.toUserId, expiresAt: addDaysMs(now, TRANSFER_TTL_DAYS) },
  });
  await audit({ userId: actor.user.id, action: "pet.ownership_transfer_request", entity: "Pet", entityId: petId, data: { transferId: transfer.id, toUserId: input.toUserId, confirmedWith: input.password ? "password" : "email_code" }, ip });
  await notify({
    userId: input.toUserId,
    type: "pet_transfer_request",
    title: `${actor.user.name} quer transferir ${actor.pet.name} para você`,
    body: `Se aceitar, você passa a ser o tutor responsável por ${actor.pet.name} e ${actor.user.name} continua com o pet compartilhado. O pedido vale por ${TRANSFER_TTL_DAYS} dias.`,
    data: { petId, transferId: transfer.id, route: "/convites" },
    email: true,
  });
  const to: UserCard = { id: access.user.id, name: access.user.name, username: access.user.username, avatarUrl: access.user.avatarUrl };
  return { id: transfer.id, to, createdAt: transfer.createdAt.toISOString(), expiresAt: transfer.expiresAt.toISOString() };
}

export async function sendTransferCode(actor: PetActor) {
  assertOwner(actor, "Apenas o tutor dono pode transferir a propriedade do pet");
  assertAlive(actor);
  return sendReauthCode(actor.user.id, "pet_transfer");
}

export async function cancelOwnershipTransfer(actor: PetActor, transferId: string) {
  assertOwner(actor);
  const res = await prisma.petOwnershipTransfer.updateMany({ where: { id: transferId, petId: actor.pet.id, status: "PENDING" }, data: { status: "CANCELED", respondedAt: new Date() } });
  if (!res.count) throw Errors.notFound("Transferência não encontrada");
  return { canceled: true };
}

// ───────────────────────────── recipient side (/me) ─────────────────────────────

const livePet = { deletedAt: null, status: "ACTIVE" } as const;

export async function myPetInvites(userId: string) {
  await expireStale({ toUserId: userId });
  const now = new Date();
  const where = { toUserId: userId, status: "PENDING" as const, expiresAt: { gt: now }, pet: livePet, fromUser: { deletedAt: null } };
  const include = { pet: { select: petCard }, fromUser: { select: userCard } };
  const [shares, transfers] = await Promise.all([
    prisma.petShareInvite.findMany({ where, include, orderBy: { createdAt: "desc" } }),
    prisma.petOwnershipTransfer.findMany({ where, include, orderBy: { createdAt: "desc" } }),
  ]);
  const shape = (r: (typeof shares)[number]) => ({ id: r.id, pet: r.pet, from: r.fromUser, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString() });
  return { shares: shares.map(shape), transfers: transfers.map(shape) };
}

/** Pending share invites + ownership transfers addressed to the user (for badges / home banner). */
export async function pendingPetInviteCount(userId: string) {
  const now = new Date();
  const where = { toUserId: userId, status: "PENDING" as const, expiresAt: { gt: now }, pet: livePet, fromUser: { deletedAt: null } };
  const [a, b] = await Promise.all([prisma.petShareInvite.count({ where }), prisma.petOwnershipTransfer.count({ where })]);
  return a + b;
}

async function loadForRecipient<T extends "invite" | "transfer">(kind: T, id: string, userId: string) {
  const include = { pet: { select: { id: true, name: true, ownerId: true, status: true, deletedAt: true, createdByPartnerId: true } }, fromUser: { select: { id: true, name: true, deletedAt: true } }, toUser: { select: { id: true, name: true } } };
  const row =
    kind === "invite"
      ? await prisma.petShareInvite.findFirst({ where: { id, toUserId: userId }, include })
      : await prisma.petOwnershipTransfer.findFirst({ where: { id, toUserId: userId }, include });
  const label = kind === "invite" ? "Convite" : "Pedido de transferência";
  if (!row) throw Errors.notFound(`${label} não encontrado`);
  if (row.status === "PENDING" && isExpired(row)) {
    if (kind === "invite") await prisma.petShareInvite.update({ where: { id }, data: { status: "EXPIRED" } });
    else await prisma.petOwnershipTransfer.update({ where: { id }, data: { status: "EXPIRED" } });
    throw Errors.conflict(`${label} expirou.`);
  }
  if (row.status === "EXPIRED") throw Errors.conflict(`${label} expirou.`);
  if (row.status !== "PENDING") throw Errors.conflict(`${label} já foi respondido ou cancelado.`);
  const stale = row.pet.deletedAt || row.pet.status !== "ACTIVE" || row.pet.ownerId !== row.fromUserId || row.fromUser.deletedAt;
  if (stale) {
    if (kind === "invite") await prisma.petShareInvite.update({ where: { id }, data: { status: "CANCELED" } });
    else await prisma.petOwnershipTransfer.update({ where: { id }, data: { status: "CANCELED" } });
    throw Errors.conflict(`${label} não é mais válido.`);
  }
  return row;
}

export async function acceptShareInvite(userId: string, inviteId: string) {
  const inv = await loadForRecipient("invite", inviteId, userId);
  const now = new Date();
  const claimed = await prisma.$transaction(async (tx) => {
    const r = await tx.petShareInvite.updateMany({ where: { id: inviteId, status: "PENDING" }, data: { status: "ACCEPTED", respondedAt: now } });
    if (!r.count) return false;
    await tx.petAccess.upsert({ where: { petId_userId: { petId: inv.petId, userId } }, create: { petId: inv.petId, userId, createdAt: now }, update: {} });
    return true;
  });
  if (!claimed) throw Errors.conflict("Convite já foi respondido.");
  await notify({
    userId: inv.fromUserId,
    type: "pet_share_accepted",
    title: `${inv.toUser.name} aceitou o compartilhamento de ${inv.pet.name}`,
    body: `${inv.toUser.name} agora acompanha ${inv.pet.name} (somente leitura e rotina).`,
    data: { petId: inv.petId, inviteId, route: petRoute(inv.petId) },
  });
  return { id: inviteId, status: "ACCEPTED" as const, petId: inv.petId };
}

export async function declineShareInvite(userId: string, inviteId: string) {
  const inv = await loadForRecipient("invite", inviteId, userId);
  const r = await prisma.petShareInvite.updateMany({ where: { id: inviteId, status: "PENDING" }, data: { status: "DECLINED", respondedAt: new Date() } });
  if (!r.count) throw Errors.conflict("Convite já foi respondido.");
  await notify({
    userId: inv.fromUserId,
    type: "pet_share_declined",
    title: `${inv.toUser.name} recusou o compartilhamento de ${inv.pet.name}`,
    data: { petId: inv.petId, inviteId, route: petRoute(inv.petId) },
  });
  return { id: inviteId, status: "DECLINED" as const, petId: inv.petId };
}

export async function acceptOwnershipTransfer(userId: string, transferId: string, ip?: string) {
  const t = await loadForRecipient("transfer", transferId, userId);
  const petId = t.petId;
  const access = await prisma.petAccess.findUnique({ where: { petId_userId: { petId, userId } }, select: { id: true } });
  if (!access) {
    await prisma.petOwnershipTransfer.update({ where: { id: transferId }, data: { status: "CANCELED" } });
    throw Errors.conflict("Pedido de transferência não é mais válido.");
  }
  // the transferred pet counts against the recipient's owner plan (same rule as creating a pet)
  if (!t.pet.createdByPartnerId) await assertLimit("OWNER", userId, "owner_pets", await ownerPetCount(userId));
  const now = new Date();
  const done = await prisma.$transaction(async (tx) => {
    const r = await tx.petOwnershipTransfer.updateMany({ where: { id: transferId, status: "PENDING" }, data: { status: "ACCEPTED", respondedAt: now } });
    if (!r.count) return false;
    const moved = await tx.pet.updateMany({ where: { id: petId, ownerId: t.fromUserId, deletedAt: null, status: "ACTIVE" }, data: { ownerId: userId, ownershipSince: now } });
    if (!moved.count) throw new ApiError(409, "CONFLICT", "Pedido de transferência não é mais válido.");
    await tx.petAccess.deleteMany({ where: { petId, userId } });
    await tx.petAccess.upsert({ where: { petId_userId: { petId, userId: t.fromUserId } }, create: { petId, userId: t.fromUserId, createdAt: now }, update: { createdAt: now } });
    await tx.petShareInvite.updateMany({ where: { petId, status: "PENDING" }, data: { status: "CANCELED", respondedAt: now } });
    await tx.petOwnershipTransfer.updateMany({ where: { petId, status: "PENDING" }, data: { status: "CANCELED", respondedAt: now } });
    return true;
  });
  if (!done) throw Errors.conflict("Pedido de transferência já foi respondido.");
  await audit({ userId, action: "pet.ownership_transfer", entity: "Pet", entityId: petId, data: { transferId, fromUserId: t.fromUserId, toUserId: userId }, ip });
  await Promise.all([
    notify({
      userId: t.fromUserId,
      type: "pet_transfer_accepted",
      title: `${t.toUser.name} agora é o tutor de ${t.pet.name}`,
      body: `A transferência foi aceita. Você continua com ${t.pet.name} compartilhado (somente leitura e rotina).`,
      data: { petId, transferId, route: petRoute(petId) },
      email: true,
    }),
    notify({
      userId,
      type: "pet_transfer_accepted",
      title: `Você agora é o tutor de ${t.pet.name}`,
      body: `${t.fromUser.name} transferiu ${t.pet.name} para você e continua com o pet compartilhado.`,
      data: { petId, transferId, route: petRoute(petId) },
      email: true,
    }),
  ]);
  return { id: transferId, status: "ACCEPTED" as const, petId };
}

export async function declineOwnershipTransfer(userId: string, transferId: string) {
  const t = await loadForRecipient("transfer", transferId, userId);
  const r = await prisma.petOwnershipTransfer.updateMany({ where: { id: transferId, status: "PENDING" }, data: { status: "DECLINED", respondedAt: new Date() } });
  if (!r.count) throw Errors.conflict("Pedido de transferência já foi respondido.");
  await notify({
    userId: t.fromUserId,
    type: "pet_transfer_declined",
    title: `${t.toUser.name} recusou a transferência de ${t.pet.name}`,
    body: `${t.pet.name} continua sob a sua responsabilidade.`,
    data: { petId: t.petId, transferId, route: petRoute(t.petId) },
    email: true,
  });
  return { id: transferId, status: "DECLINED" as const, petId: t.petId };
}

export type { UserCard };
