import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma, Prisma } from "@/db";
import { onlyDigits, toE164BR, type AddressInput, type PhoneInput, type EmailInput } from "@tinypet/shared";
import { Errors } from "./errors";
import { geocode } from "./geo";
import { sendMail, layout, escapeHtml } from "./mail";
import { rateLimit } from "./api";
import { notifyPartner } from "./notify";
import { getLimits } from "./plans";
import { dateOnly, jsonInput, petData, ymd } from "./pets";
import { toCsv, parseCsv, csvObjects } from "./csv";

// ───────────────────────────── contacts (user | client | partner scope) ─────────────────────────────

export type ContactScope = { userId: string } | { clientId: string } | { partnerId: string };

export const contactInclude = {
  phones: { orderBy: [{ isPrimary: "desc" }, { id: "asc" }] },
  emails: { orderBy: [{ isPrimary: "desc" }, { id: "asc" }] },
  addresses: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
} satisfies Prisma.ClientInclude;

export const phones = {
  list: (scope: ContactScope) => prisma.phone.findMany({ where: scope, orderBy: [{ isPrimary: "desc" }, { id: "asc" }] }),
  async create(scope: ContactScope, input: PhoneInput) {
    const count = await prisma.phone.count({ where: scope });
    const isPrimary = input.isPrimary || count === 0;
    if (isPrimary) await prisma.phone.updateMany({ where: scope, data: { isPrimary: false } });
    return prisma.phone.create({ data: { ...scope, type: input.type, number: toE164BR(input.number), isPrimary } });
  },
  async update(scope: ContactScope, id: string, input: Partial<PhoneInput>) {
    const row = await prisma.phone.findFirst({ where: { id, ...scope } });
    if (!row) throw Errors.notFound("Telefone não encontrado");
    if (input.isPrimary) await prisma.phone.updateMany({ where: scope, data: { isPrimary: false } });
    const number = input.number ? toE164BR(input.number) : undefined;
    // a changed number must be verified again
    return prisma.phone.update({ where: { id }, data: { type: input.type, number, isPrimary: input.isPrimary, ...(number && number !== row.number ? { verifiedAt: null } : {}) } });
  },
  async remove(scope: ContactScope, id: string) {
    const row = await prisma.phone.findFirst({ where: { id, ...scope } });
    if (!row) throw Errors.notFound("Telefone não encontrado");
    await prisma.phone.delete({ where: { id } });
    if (row.isPrimary) {
      const next = await prisma.phone.findFirst({ where: scope });
      if (next) await prisma.phone.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  },
};

export const emails = {
  list: (scope: ContactScope) => prisma.email.findMany({ where: scope, orderBy: [{ isPrimary: "desc" }, { id: "asc" }] }),
  async create(scope: ContactScope, input: EmailInput) {
    const count = await prisma.email.count({ where: scope });
    const isPrimary = input.isPrimary || count === 0;
    if (isPrimary) await prisma.email.updateMany({ where: scope, data: { isPrimary: false } });
    return prisma.email.create({ data: { ...scope, address: input.address.toLowerCase(), isPrimary } });
  },
  async update(scope: ContactScope, id: string, input: Partial<EmailInput>) {
    const row = await prisma.email.findFirst({ where: { id, ...scope } });
    if (!row) throw Errors.notFound("E-mail não encontrado");
    if (input.isPrimary) await prisma.email.updateMany({ where: scope, data: { isPrimary: false } });
    const changed = input.address && input.address.toLowerCase() !== row.address;
    return prisma.email.update({ where: { id }, data: { address: input.address?.toLowerCase(), isPrimary: input.isPrimary, ...(changed ? { verifiedAt: null } : {}) } });
  },
  async remove(scope: ContactScope, id: string) {
    const row = await prisma.email.findFirst({ where: { id, ...scope } });
    if (!row) throw Errors.notFound("E-mail não encontrado");
    await prisma.email.delete({ where: { id } });
    if (row.isPrimary) {
      const next = await prisma.email.findFirst({ where: scope });
      if (next) await prisma.email.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  },
};

async function withCoords<T extends { street: string; number?: string | null; district?: string | null; city: string; state: string; zipCode: string; latitude?: number | null; longitude?: number | null }>(a: T) {
  if (a.latitude != null && a.longitude != null) return { latitude: a.latitude, longitude: a.longitude };
  const g = await geocode(a);
  return { latitude: g?.lat ?? null, longitude: g?.lng ?? null };
}

export const addresses = {
  list: (scope: ContactScope) => prisma.address.findMany({ where: scope, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
  async create(scope: ContactScope, input: AddressInput) {
    const count = await prisma.address.count({ where: scope });
    const isPrimary = input.isPrimary || count === 0;
    if (isPrimary) await prisma.address.updateMany({ where: scope, data: { isPrimary: false } });
    const coords = await withCoords(input);
    const { isPrimary: _p, latitude: _la, longitude: _lo, ...rest } = input;
    return prisma.address.create({ data: { ...scope, ...rest, ...coords, isPrimary } });
  },
  async update(scope: ContactScope, id: string, input: Partial<AddressInput>) {
    const row = await prisma.address.findFirst({ where: { id, ...scope } });
    if (!row) throw Errors.notFound("Endereço não encontrado");
    if (input.isPrimary) await prisma.address.updateMany({ where: scope, data: { isPrimary: false } });
    const merged = {
      street: input.street ?? row.street,
      number: input.number === undefined ? row.number : input.number,
      district: input.district === undefined ? row.district : input.district,
      city: input.city ?? row.city,
      state: input.state ?? row.state,
      zipCode: input.zipCode ?? row.zipCode,
    };
    const addressChanged = ["street", "number", "district", "city", "state", "zipCode"].some((k) => (merged as Record<string, unknown>)[k] !== (row as Record<string, unknown>)[k]);
    // Clients re-send the stored coordinates on edit: when the address text changed, those are stale → re-geocode.
    const given = input.latitude != null && input.longitude != null;
    const staleGiven = given && addressChanged && Number(row.latitude) === Number(input.latitude) && Number(row.longitude) === Number(input.longitude);
    const coords =
      given && !staleGiven
        ? { latitude: input.latitude, longitude: input.longitude }
        : addressChanged || row.latitude == null || row.longitude == null
          ? await withCoords({ ...merged, latitude: null, longitude: null })
          : {};
    const { isPrimary, latitude: _la, longitude: _lo, ...rest } = input;
    return prisma.address.update({ where: { id }, data: { ...rest, ...coords, isPrimary } });
  },
  async remove(scope: ContactScope, id: string) {
    const row = await prisma.address.findFirst({ where: { id, ...scope } });
    if (!row) throw Errors.notFound("Endereço não encontrado");
    const used = await prisma.appointment.count({ where: { addressId: id, status: { in: ["REQUESTED", "CONFIRMED", "IN_PROGRESS"] } } });
    if (used) throw Errors.conflict("Endereço em uso em agendamentos futuros");
    await prisma.address.delete({ where: { id } });
    if (row.isPrimary) {
      const next = await prisma.address.findFirst({ where: scope });
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  },
};

// ───────────────────────────── clients ─────────────────────────────

export const clientInclude = {
  ...contactInclude,
  familyMembers: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  pets: {
    where: { pet: { deletedAt: null } },
    select: {
      pet: {
        select: { id: true, name: true, avatarUrl: true, status: true, birthDate: true, approxAgeMonths: true, sex: true, breedOther: true, ownerId: true, createdByPartnerId: true, species: { select: { key: true, label: true } }, breed: { select: { id: true, name: true } } },
      },
    },
  },
} satisfies Prisma.ClientInclude;

export type ClientRow = Prisma.ClientGetPayload<{ include: typeof clientInclude }>;

export function clientSummary(c: ClientRow) {
  const { pets, phones, emails, addresses, ...rest } = c;
  return {
    ...rest,
    tags: (c.tags as string[] | null) ?? [],
    primaryPhone: phones.find((p) => p.isPrimary)?.number ?? phones[0]?.number ?? null,
    primaryEmail: emails.find((e) => e.isPrimary)?.address ?? emails[0]?.address ?? null,
    primaryAddress: addresses.find((a) => a.isPrimary) ?? addresses[0] ?? null,
    phones,
    emails,
    addresses,
    pets: pets.map((p) => p.pet),
    linked: !!c.userId,
  };
}

export async function getClient(partnerId: string, id: string) {
  const c = await prisma.client.findFirst({ where: { id, partnerId, deletedAt: null }, include: clientInclude });
  if (!c) throw Errors.notFound("Cliente não encontrado");
  return c;
}

async function clientIdsByBirthMonth(partnerId: string, month: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM clients WHERE partner_id = ${partnerId} AND deleted_at IS NULL AND MONTH(birth_date) = ${month}`;
  return rows.map((r) => r.id);
}
export async function clientIdsByTag(partnerId: string, tag: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM clients WHERE partner_id = ${partnerId} AND deleted_at IS NULL AND tags IS NOT NULL AND JSON_CONTAINS(tags, ${JSON.stringify(tag)})`;
  return rows.map((r) => r.id);
}

export async function listClients(partnerId: string, q: { q?: string; tag?: string; species?: string; birthdayMonth?: number; page: number; pageSize: number }) {
  const and: Prisma.ClientWhereInput[] = [{ partnerId, deletedAt: null }];
  if (q.q) {
    const digits = onlyDigits(q.q);
    and.push({
      OR: [
        { name: { contains: q.q } },
        { emails: { some: { address: { contains: q.q } } } },
        ...(digits.length >= 4 ? [{ phones: { some: { number: { contains: digits } } } }] : []),
        { pets: { some: { pet: { deletedAt: null, name: { contains: q.q } } } } },
      ],
    });
  }
  if (q.species) and.push({ pets: { some: { pet: { deletedAt: null, species: { key: q.species } } } } });
  if (q.tag) and.push({ id: { in: await clientIdsByTag(partnerId, q.tag) } });
  if (q.birthdayMonth) and.push({ id: { in: await clientIdsByBirthMonth(partnerId, q.birthdayMonth) } });
  const where: Prisma.ClientWhereInput = { AND: and };
  const [total, items] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({ where, include: clientInclude, orderBy: { name: "asc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { total, items: items.map(clientSummary) };
}

export async function clientCount(partnerId: string) {
  return prisma.client.count({ where: { partnerId, deletedAt: null } });
}

type ClientBody = {
  name?: string;
  notes?: string | null;
  tags?: string[];
  source?: string | null;
  birthDate?: string | null;
  emails?: EmailInput[];
  phones?: PhoneInput[];
  addresses?: AddressInput[];
  familyMembers?: { name: string; relationship?: string | null; phone?: string | null; email?: string | null; canAuthorize?: boolean; canPickUp?: boolean }[];
};

function ensureOnePrimary<T extends { isPrimary?: boolean }>(list: T[]): T[] {
  if (!list.length) return list;
  const idx = list.findIndex((x) => x.isPrimary);
  return list.map((x, i) => ({ ...x, isPrimary: i === (idx === -1 ? 0 : idx) }));
}

export async function createClient(partnerId: string, body: ClientBody & { name: string }) {
  const addrs = await Promise.all(ensureOnePrimary(body.addresses ?? []).map(async (a) => ({ ...a, ...(await withCoords(a)) })));
  return prisma.client.create({
    data: {
      partnerId,
      name: body.name,
      notes: body.notes ?? null,
      source: body.source ?? null,
      tags: body.tags ?? [],
      birthDate: body.birthDate ? dateOnly(body.birthDate) : null,
      phones: { create: ensureOnePrimary(body.phones ?? []).map((p) => ({ type: p.type, number: toE164BR(p.number), isPrimary: p.isPrimary })) },
      emails: { create: ensureOnePrimary(body.emails ?? []).map((e) => ({ address: e.address.toLowerCase(), isPrimary: e.isPrimary })) },
      addresses: { create: addrs },
      familyMembers: { create: (body.familyMembers ?? []).map((f) => ({ ...f })) },
    },
    include: clientInclude,
  });
}

export async function updateClient(partnerId: string, id: string, body: ClientBody) {
  await getClient(partnerId, id);
  const scope = { clientId: id };
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const { emails: em, phones: ph, addresses: ad, familyMembers: fm, tags, birthDate, ...scalars } = body;
  ops.push(
    prisma.client.update({
      where: { id },
      data: { ...scalars, tags: jsonInput(tags), birthDate: birthDate === undefined ? undefined : birthDate ? dateOnly(birthDate) : null },
    }),
  );
  if (ph) {
    ops.push(prisma.phone.deleteMany({ where: scope }));
    ops.push(prisma.phone.createMany({ data: ensureOnePrimary(ph).map((p) => ({ ...scope, type: p.type, number: toE164BR(p.number), isPrimary: p.isPrimary })) }));
  }
  if (em) {
    ops.push(prisma.email.deleteMany({ where: scope }));
    ops.push(prisma.email.createMany({ data: ensureOnePrimary(em).map((e) => ({ ...scope, address: e.address.toLowerCase(), isPrimary: e.isPrimary })) }));
  }
  if (fm) {
    ops.push(prisma.familyMember.deleteMany({ where: scope }));
    ops.push(prisma.familyMember.createMany({ data: fm.map((f) => ({ ...scope, ...f })) }));
  }
  if (ad) {
    const addrs = await Promise.all(ensureOnePrimary(ad).map(async (a) => ({ ...a, ...(await withCoords(a)) })));
    ops.push(prisma.address.deleteMany({ where: { ...scope, appointments: { none: {} } } })); // keep addresses referenced by appointments
    ops.push(prisma.address.createMany({ data: addrs.map((a) => ({ ...scope, ...a })) }));
  }
  await prisma.$transaction(ops);
  return getClient(partnerId, id);
}

// ───────────────────────────── invites ─────────────────────────────

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3033";

export async function createInvite(partnerId: string, clientId: string, input: { email?: string; phone?: string }) {
  await rateLimit(`invite:partner:${partnerId}`, 30, 60 * 60 * 1000); // 30 invites / hour / partner
  const client = await getClient(partnerId, clientId);
  if (client.userId) throw Errors.conflict("Cliente já vinculado a uma conta");
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId }, select: { tradeName: true } });
  await prisma.clientInvite.updateMany({ where: { clientId, status: "PENDING" }, data: { status: "CANCELED" } });
  const invite = await prisma.clientInvite.create({
    data: { partnerId, clientId, token: randomBytes(24).toString("hex"), email: input.email ?? null, phone: input.phone ? toE164BR(input.phone) : null, expiresAt: new Date(Date.now() + 14 * 86_400_000) },
  });
  const link = `${APP_URL()}/convite/${invite.token}`;
  if (input.email) {
    const trade = escapeHtml(partner.tradeName);
    const safeLink = escapeHtml(link);
    await sendMail(
      input.email,
      `${partner.tradeName} convidou você para o tinyPet`,
      layout(
        `${partner.tradeName} quer se conectar com você`,
        `<p>Olá, ${escapeHtml(client.name)}!</p><p><strong>${trade}</strong> cadastrou você e seus pets no tinyPet. Aceite o convite para acompanhar agendamentos, histórico e muito mais.</p><p><a href="${safeLink}" style="display:inline-block;background:#f95d16;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Aceitar convite</a></p><p style="font-size:12px;color:#8792a8">O link vale por 14 dias: ${safeLink}</p>`,
      ),
      `Aceite o convite: ${link}`,
    );
  } else if (input.phone) {
    // WhatsApp provider: phase 2. Never log the tokenized link in production.
    if (process.env.NODE_ENV === "production") console.log(`[whatsapp] invite requested (invite=${invite.id})`);
    else console.log(`[whatsapp][dev] to=${input.phone} invite=${link}`);
  }
  return { ...invite, link };
}

export async function inviteByToken(token: string) {
  const invite = await prisma.clientInvite.findUnique({
    where: { token },
    include: {
      partner: { select: { id: true, slug: true, tradeName: true, logoUrl: true } },
      client: { select: { id: true, name: true, userId: true, deletedAt: true, pets: { where: { pet: { deletedAt: null } }, select: { pet: { select: { id: true, name: true, avatarUrl: true, birthDate: true, ownerId: true, species: { select: { key: true, label: true } }, breed: { select: { name: true } } } } } } } },
    },
  });
  if (!invite || invite.client.deletedAt) throw Errors.notFound("Convite não encontrado");
  if (invite.status === "PENDING" && invite.expiresAt < new Date()) {
    await prisma.clientInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    invite.status = "EXPIRED";
  }
  return invite;
}

/** An invite is bound to its recipient: the invite e-mail must be the login e-mail or a verified e-mail of the user, or the invite phone a verified phone. */
export async function inviteMatchesUser(invite: { email: string | null; phone: string | null }, userId: string): Promise<boolean> {
  if (invite.email) {
    const target = invite.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
    if (user?.emailVerifiedAt && user.email.toLowerCase() === target) return true;
    const verified = await prisma.email.findMany({ where: { userId, verifiedAt: { not: null } }, select: { address: true } });
    if (verified.some((e) => e.address.toLowerCase() === target)) return true;
  }
  if (invite.phone) {
    const target = onlyDigits(invite.phone);
    const verified = await prisma.phone.findMany({ where: { userId, verifiedAt: { not: null } }, select: { number: true } });
    if (target && verified.some((p) => onlyDigits(p.number) === target || onlyDigits(toE164BR(p.number)) === target)) return true;
  }
  return false;
}

export async function acceptInvite(userId: string, input: { token: string; petMerges?: { partnerPetId: string; ownerPetId: string | null }[] }) {
  const invite = await inviteByToken(input.token);
  if (invite.status !== "PENDING") throw Errors.badRequest(invite.status === "EXPIRED" ? "Convite expirado" : "Convite não está mais disponível");
  if (!(await inviteMatchesUser(invite, userId))) throw Errors.forbidden("Este convite foi enviado para outro e-mail/telefone. Entre com a conta correta.");
  if (invite.client.userId && invite.client.userId !== userId) throw Errors.conflict("Este cliente já está vinculado a outra conta");
  const clientId = invite.client.id;
  const merges = new Map((input.petMerges ?? []).map((m) => [m.partnerPetId, m.ownerPetId]));
  const merged: { partnerPetId: string; ownerPetId: string | null; action: "merged" | "adopted" | "kept" }[] = [];

  for (const { pet } of invite.client.pets) {
    const ownerPetId = merges.get(pet.id) ?? null;
    if (ownerPetId) {
      const own = await prisma.pet.findFirst({ where: { id: ownerPetId, ownerId: userId, deletedAt: null } });
      if (!own) throw Errors.badRequest("Pet do tutor inválido para unificação");
      await prisma.$transaction([
        prisma.clientPet.upsert({ where: { clientId_petId: { clientId, petId: ownerPetId } }, update: {}, create: { clientId, petId: ownerPetId } }),
        prisma.clientPet.deleteMany({ where: { clientId, petId: pet.id } }),
        prisma.pet.update({ where: { id: pet.id }, data: { deletedAt: new Date() } }),
      ]);
      merged.push({ partnerPetId: pet.id, ownerPetId, action: "merged" });
    } else if (!pet.ownerId) {
      await prisma.pet.update({ where: { id: pet.id }, data: { ownerId: userId } }); // keeps createdByPartnerId → not counted in the Free limit
      merged.push({ partnerPetId: pet.id, ownerPetId: null, action: "adopted" });
    } else {
      merged.push({ partnerPetId: pet.id, ownerPetId: null, action: "kept" });
    }
  }
  await prisma.$transaction([
    prisma.client.update({ where: { id: clientId }, data: { userId } }),
    prisma.clientInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } }),
    prisma.clientInvite.updateMany({ where: { clientId, status: "PENDING", id: { not: invite.id } }, data: { status: "CANCELED" } }),
  ]);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
  await notifyPartner(invite.partnerId, { type: "client_linked", title: `${user.name} aceitou o convite`, body: `O cliente ${invite.client.name} agora está vinculado à conta do tutor.`, data: { clientId } });
  const client = await getClient(invite.partnerId, clientId);
  return { client: clientSummary(client), merges: merged };
}

// ───────────────────────────── birthdays, export, import ─────────────────────────────

export async function birthdays(partnerId: string, month: number) {
  const clientIds = await clientIdsByBirthMonth(partnerId, month);
  const petRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT p.id FROM pets p
    JOIN client_pets cp ON cp.pet_id = p.id
    JOIN clients c ON c.id = cp.client_id
    WHERE c.partner_id = ${partnerId} AND c.deleted_at IS NULL AND p.deleted_at IS NULL AND p.status = 'ACTIVE' AND MONTH(p.birth_date) = ${month}`;
  const [clients, pets] = await Promise.all([
    prisma.client.findMany({ where: { id: { in: clientIds } }, include: clientInclude }),
    prisma.pet.findMany({
      where: { id: { in: petRows.map((r) => r.id) } },
      select: { id: true, name: true, avatarUrl: true, birthDate: true, species: { select: { key: true, label: true } }, clients: { where: { client: { partnerId, deletedAt: null } }, select: { client: { select: { id: true, name: true, phones: { select: { number: true, isPrimary: true } } } } } } },
    }),
  ]);
  const day = (d: Date | null) => (d ? Number(ymd(d).slice(8, 10)) : 0);
  return {
    clients: clients.map(clientSummary).sort((a, b) => day(a.birthDate) - day(b.birthDate)),
    pets: pets.map((p) => ({ ...p, clients: p.clients.map(({ client: { phones, ...c } }) => ({ ...c, primaryPhone: phones.find((ph) => ph.isPrimary)?.number ?? phones[0]?.number ?? null })) })).sort((a, b) => day(a.birthDate) - day(b.birthDate)),
  };
}

export async function exportClientsCsv(partnerId: string) {
  const rows = await prisma.client.findMany({ where: { partnerId, deletedAt: null }, include: clientInclude, orderBy: { name: "asc" } });
  const items = rows.map(clientSummary);
  return toCsv(items as unknown as Record<string, unknown>[], [
    { key: "name", label: "name" },
    { key: "email", label: "email", get: (r) => (r as unknown as ReturnType<typeof clientSummary>).primaryEmail },
    { key: "phone", label: "phone", get: (r) => (r as unknown as ReturnType<typeof clientSummary>).primaryPhone },
    { key: "petName", label: "petName", get: (r) => (r as unknown as ReturnType<typeof clientSummary>).pets.map((p) => p.name) },
    { key: "species", label: "species", get: (r) => (r as unknown as ReturnType<typeof clientSummary>).pets.map((p) => p.species.key) },
    { key: "tags", label: "tags", get: (r) => (r as unknown as ReturnType<typeof clientSummary>).tags },
    { key: "birthDate", label: "birthDate" },
    { key: "city", label: "city", get: (r) => (r as unknown as ReturnType<typeof clientSummary>).primaryAddress?.city ?? "" },
    { key: "state", label: "state", get: (r) => (r as unknown as ReturnType<typeof clientSummary>).primaryAddress?.state ?? "" },
    { key: "source", label: "source" },
    { key: "createdAt", label: "createdAt" },
  ]);
}

export const IMPORT_MAX_ROWS = 5000;
const IMPORT_MAX_COLUMNS = 40;
const importEmail = z.string().trim().toLowerCase().email().max(200);

/**
 * CSV columns: name,email,phone,petName,species (species key or pt-BR label). At most 5000 rows.
 * Invalid rows (name 2–120 chars, valid e-mail, phone ≤ 20 digits) go to `errors[]`; rows already present (same name +
 * same e-mail/phone) are skipped.
 */
export async function importClientsCsv(partnerId: string, text: string) {
  const table = parseCsv(text);
  // limits checked before building objects (rows × header columns would otherwise blow up memory)
  if (table.length - 1 > IMPORT_MAX_ROWS) throw Errors.badRequest(`O arquivo tem ${table.length - 1} linhas; o máximo é ${IMPORT_MAX_ROWS} por importação`);
  if ((table[0]?.length ?? 0) > IMPORT_MAX_COLUMNS) throw Errors.badRequest(`O cabeçalho tem colunas demais (máximo ${IMPORT_MAX_COLUMNS})`);
  const rows = csvObjects(table);
  const species = await prisma.species.findMany({ where: { active: true } });
  const speciesFor = (v: string) => {
    const k = v.trim().toLowerCase();
    return species.find((s) => s.key === k || s.label.toLowerCase() === k) ?? species.find((s) => s.key === "other") ?? null;
  };
  const { planKey, limits } = await getLimits("PARTNER", partnerId);
  const limit = limits.crm_clients;
  let current = await clientCount(partnerId);
  if (limit && !limit.enabled) throw Errors.planLimit({ featureKey: "crm_clients", current, limit: 0, planKey });
  if (limit?.quantity != null && current >= limit.quantity) throw Errors.planLimit({ featureKey: "crm_clients", current, limit: limit.quantity, planKey });

  let created = 0;
  let skipped = 0;
  let limitReached = false;
  const errors: { row: number; message: string }[] = [];
  for (const [i, r] of rows.entries()) {
    const name = r.name?.trim();
    if (!name) {
      skipped++;
      continue;
    }
    const rowErrors: string[] = [];
    if (name.length < 2 || name.length > 120) rowErrors.push("nome deve ter de 2 a 120 caracteres");
    const rawEmail = r.email?.trim();
    if (rawEmail && !importEmail.safeParse(rawEmail).success) rowErrors.push("e-mail inválido");
    const rawPhone = r.phone?.trim();
    if (rawPhone && (onlyDigits(rawPhone).length === 0 || onlyDigits(rawPhone).length > 20)) rowErrors.push("telefone inválido (máx. 20 dígitos)");
    const petNameRaw = r.petname?.trim();
    if (petNameRaw && petNameRaw.length > 120) rowErrors.push("nome do pet acima de 120 caracteres");
    if (rowErrors.length) {
      errors.push({ row: i + 2, message: rowErrors.join("; ") });
      skipped++;
      continue;
    }
    if (limit?.quantity != null && current >= limit.quantity) {
      limitReached = true;
      skipped++;
      continue;
    }
    const email = r.email?.trim().toLowerCase() || null;
    const phone = r.phone?.trim() ? toE164BR(r.phone) : null;
    const dup = await prisma.client.findFirst({
      where: { partnerId, deletedAt: null, name: { equals: name }, ...(email || phone ? { OR: [...(email ? [{ emails: { some: { address: email } } }] : []), ...(phone ? [{ phones: { some: { number: phone } } }] : [])] } : {}) },
    });
    if (dup) {
      skipped++;
      continue;
    }
    try {
      const client = await prisma.client.create({
        data: {
          partnerId,
          name,
          source: "import",
          tags: [],
          emails: email ? { create: [{ address: email, isPrimary: true }] } : undefined,
          phones: phone ? { create: [{ number: phone, isPrimary: true }] } : undefined,
        },
      });
      const petName = r.petname?.trim();
      if (petName) {
        const sp = speciesFor(r.species ?? "");
        if (sp) {
          await prisma.pet.create({ data: { name: petName, speciesId: sp.id, createdByPartnerId: partnerId, clients: { create: [{ clientId: client.id }] } } });
        }
      }
      created++;
      current++;
    } catch (e) {
      console.warn("[import] row failed", e);
      errors.push({ row: i + 2, message: "Erro ao importar a linha" });
      skipped++;
    }
  }
  return { created, skipped, limitReached, errors };
}

/** Creates a partner-side pet for a client and links it (ClientPet). If the client is linked to a user, the pet is theirs. */
export async function createClientPet(partnerId: string, clientId: string, body: Parameters<typeof petData>[0] & { name: string; speciesKey: string }) {
  const client = await getClient(partnerId, clientId);
  const data = await petData(body);
  return prisma.pet.create({
    data: { ...(data as Prisma.PetUncheckedCreateInput), name: body.name, speciesId: data.speciesId as string, createdByPartnerId: partnerId, ownerId: client.userId ?? null, clients: { create: [{ clientId }] } },
    include: { species: { select: { id: true, key: true, label: true } }, breed: { select: { id: true, name: true } } },
  });
}
