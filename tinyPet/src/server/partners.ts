import { prisma, Prisma } from "@/db";
import { slugify, isValidCNPJ, isValidCPF, onlyDigits, toE164BR, VENUE_PHOTOS_MAX } from "@tinypet/shared";
import type { CreatePartnerInput, UpdatePartnerInput, PhoneInput, EmailInput, AddressInput } from "@tinypet/shared";
import { startOfDay, addDays, startOfWeek, differenceInCalendarDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { Errors } from "./errors";
import { ensureDefaultSubscription, partnerUsage, assertLimit } from "./plans";
import { geocode, lookupCnpj } from "./geo";
import { sendVerificationCode, consumeVerificationCode } from "./verification";

const TZ = "America/Sao_Paulo";

// ───────────────────────────── helpers ─────────────────────────────

/** `slugify(tradeName)`; appends `-2`, `-3`, … on collision. */
export async function uniqueSlug(tradeName: string, excludeId?: string) {
  const base = slugify(tradeName) || "parceiro";
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await prisma.partner.findFirst({ where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
}

/** Validates CNPJ/CPF; returns the normalized digits (or null when no document). */
export function normalizeDocument(type: "CNPJ" | "CPF" | null | undefined, document: string | null | undefined) {
  if (!type || !document) return { documentType: null, document: null };
  const d = onlyDigits(document);
  if (type === "CNPJ" && !isValidCNPJ(d)) throw Errors.badRequest("CNPJ inválido");
  if (type === "CPF" && !isValidCPF(d)) throw Errors.badRequest("CPF inválido");
  return { documentType: type, document: d };
}

export async function assertPartnerExists(partnerId: string) {
  const p = await prisma.partner.findFirst({ where: { id: partnerId, deletedAt: null } });
  if (!p) throw Errors.notFound("Parceiro não encontrado");
  return p;
}

// ───────────────────────────── partner CRUD ─────────────────────────────

export async function createPartner(userId: string, input: CreatePartnerInput) {
  const types = await prisma.partnerType.findMany({ where: { key: { in: input.typeKeys }, active: true } });
  if (types.length !== new Set(input.typeKeys).size) throw Errors.badRequest("Tipo de parceiro inválido");
  const doc = normalizeDocument(input.documentType, input.document);
  let legalName: string | null = null;
  if (doc.documentType === "CNPJ" && doc.document) legalName = (await lookupCnpj(doc.document))?.legalName ?? null;

  const slug = await uniqueSlug(input.tradeName);
  const partner = await prisma.partner.create({
    data: {
      slug,
      tradeName: input.tradeName,
      legalName,
      description: input.description ?? null,
      ...doc,
      types: { create: types.map((t) => ({ typeId: t.id })) },
      memberships: { create: { userId, role: "OWNER", canSeeFinance: true } },
    },
    include: { memberships: true },
  });
  await ensureDefaultSubscription("PARTNER", partner.id);
  const owner = partner.memberships[0]!;
  await prisma.availability.createMany({ data: [1, 2, 3, 4, 5].map((weekday) => ({ membershipId: owner.id, weekday, startsAt: "08:00", endsAt: "18:00" })) });
  return getPartnerFull(partner.id);
}

export async function getPartnerFull(partnerId: string) {
  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, deletedAt: null },
    include: {
      types: { include: { type: true } },
      socialLinks: true,
      businessHours: { orderBy: { weekday: "asc" } },
      venuePhotos: { orderBy: { sortOrder: "asc" } },
      phones: true,
      emails: true,
      addresses: true,
    },
  });
  if (!partner) throw Errors.notFound("Parceiro não encontrado");
  const plan = await partnerUsage(partnerId);
  return { ...partner, types: partner.types.map((t) => ({ key: t.type.key, label: t.type.label })), plan };
}

export async function updatePartner(partnerId: string, input: UpdatePartnerInput) {
  const current = await assertPartnerExists(partnerId);
  const data: Prisma.PartnerUpdateInput = {};

  if (input.tradeName !== undefined) {
    data.tradeName = input.tradeName;
    if (input.tradeName !== current.tradeName) data.slug = await uniqueSlug(input.tradeName, partnerId);
  }
  if (input.description !== undefined) data.description = input.description;
  if (input.legalName !== undefined) data.legalName = input.legalName;
  if (input.website !== undefined) data.website = input.website || null;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
  if (input.serviceRadiusKm !== undefined) data.serviceRadiusKm = input.serviceRadiusKm;
  if (input.cancellationHours !== undefined) data.cancellationHours = input.cancellationHours;
  if (input.bufferMinutes !== undefined) data.bufferMinutes = input.bufferMinutes;
  if (input.travelSlackMinutes !== undefined) data.travelSlackMinutes = input.travelSlackMinutes;

  if (input.documentType !== undefined || input.document !== undefined) {
    const doc = normalizeDocument(input.documentType ?? current.documentType, input.document ?? current.document);
    data.documentType = doc.documentType;
    data.document = doc.document;
    const wantsLegalName = input.legalName === undefined || input.legalName === null || input.legalName === "";
    if (doc.documentType === "CNPJ" && doc.document && wantsLegalName && !current.legalName) {
      data.legalName = (await lookupCnpj(doc.document))?.legalName ?? null;
    }
  }

  if (input.typeKeys) {
    const types = await prisma.partnerType.findMany({ where: { key: { in: input.typeKeys }, active: true } });
    if (types.length !== new Set(input.typeKeys).size) throw Errors.badRequest("Tipo de parceiro inválido");
    data.types = { deleteMany: {}, create: types.map((t) => ({ typeId: t.id })) };
  }
  if (input.socialLinks) {
    data.socialLinks = { deleteMany: {}, create: input.socialLinks.map((s) => ({ network: s.network, url: s.url })) };
  }
  if (input.businessHours) {
    data.businessHours = { deleteMany: {}, create: input.businessHours.map((h) => ({ weekday: h.weekday, opensAt: h.opensAt, closesAt: h.closesAt, closed: h.closed })) };
  }

  await prisma.partner.update({ where: { id: partnerId }, data });
  return getPartnerFull(partnerId);
}

export async function softDeletePartner(partnerId: string) {
  await assertPartnerExists(partnerId);
  await prisma.partner.update({ where: { id: partnerId }, data: { deletedAt: new Date(), published: false } });
}

// ───────────────────────────── publish ─────────────────────────────

/** Publish checklist. Returns pt-BR reasons for what is still missing. */
export async function publishChecks(partnerId: string) {
  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, deletedAt: null },
    include: { emails: true, phones: true, addresses: { where: { isPrimary: true }, take: 1 } },
  });
  if (!partner) throw Errors.notFound("Parceiro não encontrado");

  const missing: string[] = [];
  // a verified contact row must still exist (the partner-level flags are kept in sync by syncVerifiedFlags)
  const emailVerified = partner.emails.some((e) => e.verifiedAt);
  const phoneVerified = partner.phones.some((p) => p.verifiedAt);
  if (!emailVerified) missing.push("Verifique o e-mail do parceiro");
  if (!phoneVerified) missing.push("Verifique o celular do parceiro");
  const hasLocation = !!partner.logoUrl || partner.addresses.length > 0 || (partner.serviceRadiusKm ?? 0) > 0;
  if (!hasLocation) missing.push("Adicione uma logomarca, um endereço principal ou a área de atendimento (raio em km)");
  const items = await prisma.catalogItem.count({ where: { partnerId, deletedAt: null, status: "PUBLISHED" } });
  if (items === 0) missing.push("Publique ao menos um item no catálogo");
  return { partner, missing };
}

export async function publishPartner(partnerId: string) {
  const { missing } = await publishChecks(partnerId);
  if (missing.length) return { published: false, missing };
  await prisma.partner.update({ where: { id: partnerId }, data: { published: true } });
  return { published: true, missing: [] as string[] };
}

// ───────────────────────────── verification (partner-level) ─────────────────────────────

export async function sendPartnerVerification(userId: string, partnerId: string, channel: "EMAIL" | "PHONE") {
  let target: string | undefined;
  if (channel === "EMAIL") {
    target = (await prisma.email.findFirst({ where: { partnerId }, orderBy: { isPrimary: "desc" } }))?.address;
    if (!target) throw Errors.badRequest("Cadastre um e-mail do parceiro antes de verificar");
  } else {
    target = (await prisma.phone.findFirst({ where: { partnerId }, orderBy: { isPrimary: "desc" } }))?.number;
    if (!target) throw Errors.badRequest("Cadastre um celular do parceiro antes de verificar");
  }
  await sendVerificationCode(userId, channel, target);
  return { sent: true, channel, target };
}

export async function confirmPartnerVerification(userId: string, partnerId: string, channel: "EMAIL" | "PHONE", code: string) {
  // Only codes sent to one of THIS partner's contacts count (not the user's personal e-mail/phone).
  const targets =
    channel === "EMAIL"
      ? (await prisma.email.findMany({ where: { partnerId }, select: { address: true } })).map((e) => e.address)
      : (await prisma.phone.findMany({ where: { partnerId }, select: { number: true } })).map((p) => p.number);
  const target = await consumeVerificationCode(userId, channel, code, targets);
  const now = new Date();
  if (channel === "EMAIL") {
    await prisma.partner.update({ where: { id: partnerId }, data: { emailVerifiedAt: now } });
    await prisma.email.updateMany({ where: { partnerId, address: target }, data: { verifiedAt: now } });
  } else {
    await prisma.partner.update({ where: { id: partnerId }, data: { phoneVerifiedAt: now } });
    await prisma.phone.updateMany({ where: { partnerId, number: target }, data: { verifiedAt: now } });
  }
  return { verified: true, channel, target };
}

// ───────────────────────────── contacts (phones | emails | addresses) ─────────────────────────────

export type ContactKind = "phones" | "emails" | "addresses";
export const CONTACT_KINDS: ContactKind[] = ["phones", "emails", "addresses"];

export async function listContacts(partnerId: string, kind: ContactKind) {
  const where = { partnerId };
  const orderBy = { isPrimary: "desc" as const };
  if (kind === "phones") return prisma.phone.findMany({ where, orderBy });
  if (kind === "emails") return prisma.email.findMany({ where, orderBy });
  return prisma.address.findMany({ where, orderBy });
}

async function unsetPrimary(partnerId: string, kind: ContactKind, exceptId?: string) {
  const where = { partnerId, isPrimary: true, ...(exceptId ? { NOT: { id: exceptId } } : {}) };
  if (kind === "phones") await prisma.phone.updateMany({ where, data: { isPrimary: false } });
  else if (kind === "emails") await prisma.email.updateMany({ where, data: { isPrimary: false } });
  else await prisma.address.updateMany({ where, data: { isPrimary: false } });
}

async function withGeo<T extends Partial<AddressInput>>(input: T, fallback?: { street: string; number?: string | null; district?: string | null; city: string; state: string; zipCode: string }) {
  if (input.latitude != null && input.longitude != null) return input;
  const addr = {
    street: input.street ?? fallback?.street ?? "",
    number: input.number ?? fallback?.number,
    district: input.district ?? fallback?.district,
    city: input.city ?? fallback?.city ?? "",
    state: input.state ?? fallback?.state ?? "",
    zipCode: input.zipCode ?? fallback?.zipCode,
  };
  if (!addr.street || !addr.city) return input;
  const geo = await geocode(addr);
  return geo ? { ...input, latitude: geo.lat, longitude: geo.lng } : input;
}

export async function createContact(partnerId: string, kind: ContactKind, body: PhoneInput | EmailInput | AddressInput) {
  await assertPartnerExists(partnerId);
  if (kind === "phones") {
    const b = body as PhoneInput;
    const count = await prisma.phone.count({ where: { partnerId } });
    const isPrimary = b.isPrimary || count === 0;
    if (isPrimary) await unsetPrimary(partnerId, kind);
    return prisma.phone.create({ data: { partnerId, type: b.type, number: toE164BR(b.number), isPrimary } });
  }
  if (kind === "emails") {
    const b = body as EmailInput;
    const count = await prisma.email.count({ where: { partnerId } });
    const isPrimary = b.isPrimary || count === 0;
    if (isPrimary) await unsetPrimary(partnerId, kind);
    return prisma.email.create({ data: { partnerId, address: b.address, isPrimary } });
  }
  const b = await withGeo(body as AddressInput);
  const count = await prisma.address.count({ where: { partnerId } });
  const isPrimary = b.isPrimary || count === 0;
  if (isPrimary) await unsetPrimary(partnerId, kind);
  const { isPrimary: _p, ...rest } = b;
  return prisma.address.create({ data: { ...rest, partnerId, isPrimary } });
}

export async function updateContact(partnerId: string, kind: ContactKind, cid: string, body: Partial<PhoneInput | EmailInput | AddressInput>) {
  if (kind === "phones") {
    const ex = await prisma.phone.findFirst({ where: { id: cid, partnerId } });
    if (!ex) throw Errors.notFound("Telefone não encontrado");
    const b = body as Partial<PhoneInput>;
    if (b.isPrimary) await unsetPrimary(partnerId, kind, cid);
    const number = b.number !== undefined ? toE164BR(b.number) : undefined;
    const row = await prisma.phone.update({ where: { id: cid }, data: { type: b.type, number, isPrimary: b.isPrimary, ...(number && number !== ex.number ? { verifiedAt: null } : {}) } });
    await syncVerifiedFlags(partnerId, kind);
    return row;
  }
  if (kind === "emails") {
    const ex = await prisma.email.findFirst({ where: { id: cid, partnerId } });
    if (!ex) throw Errors.notFound("E-mail não encontrado");
    const b = body as Partial<EmailInput>;
    if (b.isPrimary) await unsetPrimary(partnerId, kind, cid);
    const row = await prisma.email.update({ where: { id: cid }, data: { address: b.address, isPrimary: b.isPrimary, ...(b.address && b.address !== ex.address ? { verifiedAt: null } : {}) } });
    await syncVerifiedFlags(partnerId, kind);
    return row;
  }
  const ex = await prisma.address.findFirst({ where: { id: cid, partnerId } });
  if (!ex) throw Errors.notFound("Endereço não encontrado");
  const b = await withGeo(body as Partial<AddressInput>, ex);
  if (b.isPrimary) await unsetPrimary(partnerId, kind, cid);
  return prisma.address.update({ where: { id: cid }, data: { ...b } });
}

/** Partner.emailVerifiedAt / phoneVerifiedAt only while some e-mail / phone row is still verified (edits and deletes reset rows). */
async function syncVerifiedFlags(partnerId: string, kind: ContactKind) {
  if (kind === "emails") {
    const n = await prisma.email.count({ where: { partnerId, verifiedAt: { not: null } } });
    if (!n) await prisma.partner.update({ where: { id: partnerId }, data: { emailVerifiedAt: null } });
  } else if (kind === "phones") {
    const n = await prisma.phone.count({ where: { partnerId, verifiedAt: { not: null } } });
    if (!n) await prisma.partner.update({ where: { id: partnerId }, data: { phoneVerifiedAt: null } });
  }
}

export async function deleteContact(partnerId: string, kind: ContactKind, cid: string) {
  const where = { id: cid, partnerId };
  if (kind === "phones") {
    const ex = await prisma.phone.findFirst({ where });
    if (!ex) throw Errors.notFound("Telefone não encontrado");
    await prisma.phone.delete({ where: { id: cid } });
  } else if (kind === "emails") {
    const ex = await prisma.email.findFirst({ where });
    if (!ex) throw Errors.notFound("E-mail não encontrado");
    await prisma.email.delete({ where: { id: cid } });
  } else {
    const ex = await prisma.address.findFirst({ where });
    if (!ex) throw Errors.notFound("Endereço não encontrado");
    await prisma.address.delete({ where: { id: cid } });
  }
  await syncVerifiedFlags(partnerId, kind);
}

// ───────────────────────────── venue photos ─────────────────────────────

export async function listVenuePhotos(partnerId: string) {
  return prisma.venuePhoto.findMany({ where: { partnerId }, orderBy: { sortOrder: "asc" } });
}

export async function addVenuePhoto(partnerId: string, input: { url: string; thumbUrl?: string | null; caption?: string | null; sortOrder?: number }) {
  await assertPartnerExists(partnerId);
  const count = await prisma.venuePhoto.count({ where: { partnerId } });
  if (count >= VENUE_PHOTOS_MAX) throw Errors.badRequest(`Máximo de ${VENUE_PHOTOS_MAX} fotos do estabelecimento`);
  return prisma.venuePhoto.create({ data: { partnerId, url: input.url, thumbUrl: input.thumbUrl ?? null, caption: input.caption ?? null, sortOrder: input.sortOrder ?? count } });
}

export async function updateVenuePhoto(partnerId: string, pid: string, input: Partial<{ url: string; thumbUrl: string | null; caption: string | null; sortOrder: number }>) {
  const ex = await prisma.venuePhoto.findFirst({ where: { id: pid, partnerId } });
  if (!ex) throw Errors.notFound("Foto não encontrada");
  return prisma.venuePhoto.update({ where: { id: pid }, data: input });
}

export async function deleteVenuePhoto(partnerId: string, pid: string) {
  const ex = await prisma.venuePhoto.findFirst({ where: { id: pid, partnerId } });
  if (!ex) throw Errors.notFound("Foto não encontrada");
  await prisma.venuePhoto.delete({ where: { id: pid } });
}

export async function reorderVenuePhotos(partnerId: string, ids: string[]) {
  const photos = await prisma.venuePhoto.findMany({ where: { partnerId }, select: { id: true } });
  const known = new Set(photos.map((p) => p.id));
  if (ids.some((id) => !known.has(id))) throw Errors.badRequest("Foto inválida na ordenação");
  await prisma.$transaction(ids.map((id, i) => prisma.venuePhoto.update({ where: { id }, data: { sortOrder: i } })));
  return listVenuePhotos(partnerId);
}

// ───────────────────────────── team ─────────────────────────────

const memberSelect = {
  id: true,
  role: true,
  canSeeFinance: true,
  jobTitle: true,
  baseAddressId: true,
  costPerKm: true,
  navApp: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.MembershipSelect;

export async function listMembers(partnerId: string) {
  return prisma.membership.findMany({ where: { partnerId }, select: memberSelect, orderBy: { createdAt: "asc" } });
}

export async function inviteMember(partnerId: string, input: { email: string; role: "OWNER" | "STAFF"; canSeeFinance: boolean; jobTitle?: string | null }) {
  const user = await prisma.user.findFirst({ where: { email: input.email, deletedAt: null } });
  if (!user) throw Errors.notFound("Nenhum usuário com este e-mail. Peça para a pessoa criar uma conta no tinyPet primeiro.");
  const exists = await prisma.membership.findUnique({ where: { userId_partnerId: { userId: user.id, partnerId } } });
  if (exists) throw Errors.conflict("Esta pessoa já faz parte da equipe");
  await assertLimit("PARTNER", partnerId, "team_members", await prisma.membership.count({ where: { partnerId } }));
  const m = await prisma.membership.create({
    data: { partnerId, userId: user.id, role: input.role, canSeeFinance: input.canSeeFinance, jobTitle: input.jobTitle ?? null },
    select: memberSelect,
  });
  await prisma.availability.createMany({ data: [1, 2, 3, 4, 5].map((weekday) => ({ membershipId: m.id, weekday, startsAt: "08:00", endsAt: "18:00" })) });
  return m;
}

export async function updateMember(partnerId: string, mid: string, input: { role?: "OWNER" | "STAFF"; canSeeFinance?: boolean; jobTitle?: string | null; baseAddressId?: string | null; costPerKm?: number | null; navApp?: string | null }) {
  const m = await prisma.membership.findFirst({ where: { id: mid, partnerId } });
  if (!m) throw Errors.notFound("Membro não encontrado");
  if (input.role === "STAFF" && m.role === "OWNER") {
    const owners = await prisma.membership.count({ where: { partnerId, role: "OWNER" } });
    if (owners <= 1) throw Errors.badRequest("O parceiro precisa de ao menos um dono");
  }
  if (input.baseAddressId) {
    const addr = await prisma.address.findFirst({ where: { id: input.baseAddressId, OR: [{ partnerId }, { userId: m.userId }] } });
    if (!addr) throw Errors.badRequest("Endereço base inválido");
  }
  return prisma.membership.update({ where: { id: mid }, data: input, select: memberSelect });
}

export async function removeMember(partnerId: string, mid: string) {
  const m = await prisma.membership.findFirst({ where: { id: mid, partnerId } });
  if (!m) throw Errors.notFound("Membro não encontrado");
  if (m.role === "OWNER") {
    const owners = await prisma.membership.count({ where: { partnerId, role: "OWNER" } });
    if (owners <= 1) throw Errors.badRequest("O parceiro precisa de ao menos um dono");
  }
  await prisma.membership.delete({ where: { id: mid } });
}

// ───────────────────────────── dashboard ─────────────────────────────

/** [start, end) of the current day in America/Sao_Paulo, as UTC instants. */
export function todayBounds(now = new Date()) {
  const zoned = toZonedTime(now, TZ);
  const dayStart = startOfDay(zoned);
  return { start: fromZonedTime(dayStart, TZ), end: fromZonedTime(addDays(dayStart, 1), TZ), zonedDayStart: dayStart };
}

export async function partnerDashboard(partnerId: string) {
  const now = new Date();
  const { start, end, zonedDayStart } = todayBounds(now);
  const weekStart = fromZonedTime(startOfWeek(zonedDayStart, { weekStartsOn: 1 }), TZ);
  const weekEnd = addDays(weekStart, 7);
  const in30 = addDays(zonedDayStart, 30);

  const [today, receivable, overdue, clients, pets, appointmentsWeek] = await Promise.all([
    prisma.appointment.findMany({
      where: { partnerId, startsAt: { gte: start, lt: end }, status: { notIn: ["CANCELED"] } },
      orderBy: { startsAt: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        item: { select: { id: true, name: true, durationMinutes: true } },
        membership: { select: { id: true, user: { select: { name: true } } } },
        address: true,
        pets: { include: { pet: { select: { id: true, name: true, avatarUrl: true } } } },
      },
    }),
    prisma.installment.findMany({
      where: { contract: { partnerId, status: { in: ["ACTIVE", "COMPLETED"] } }, status: "PENDING", dueDate: { gte: zonedDayStart, lte: in30 } },
      select: { amount: true, paidAmount: true },
    }),
    prisma.installment.findMany({
      where: { contract: { partnerId, status: { in: ["ACTIVE", "COMPLETED"] } }, OR: [{ status: "OVERDUE" }, { status: "PENDING", dueDate: { lt: zonedDayStart } }] },
      orderBy: { dueDate: "asc" },
      include: { contract: { select: { id: true, title: true, client: { select: { id: true, name: true } } } } },
    }),
    prisma.client.count({ where: { partnerId, deletedAt: null } }),
    prisma.clientPet.count({ where: { client: { partnerId, deletedAt: null }, pet: { deletedAt: null } } }),
    prisma.appointment.count({ where: { partnerId, startsAt: { gte: weekStart, lt: weekEnd }, status: { notIn: ["CANCELED"] } } }),
  ]);

  const receivable30d = receivable.reduce((s, i) => s + (Number(i.amount) - Number(i.paidAmount)), 0);
  return {
    today: today.map((a) => ({ ...a, pets: a.pets.map((p) => p.pet) })),
    receivable30d: Math.round(receivable30d * 100) / 100,
    overdue: overdue.map((i) => ({
      id: i.id,
      number: i.number,
      dueDate: i.dueDate,
      amount: Number(i.amount),
      paidAmount: Number(i.paidAmount),
      status: i.status,
      contractId: i.contract.id,
      contractTitle: i.contract.title,
      clientId: i.contract.client.id,
      clientName: i.contract.client.name,
      daysLate: Math.max(0, differenceInCalendarDays(zonedDayStart, i.dueDate)),
    })),
    counts: { clients, pets, appointmentsWeek },
  };
}
