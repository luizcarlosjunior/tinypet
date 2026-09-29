import type { NextRequest } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { prisma, Prisma, type PetSize } from "@tinypet/db";
import {
  ageInMonths,
  formatAge,
  haversineKm,
  lifeStageFor,
  DEFAULT_LIFE_STAGE_RULES,
  WEIGHT_ALERT_PCT,
  WEIGHT_ALERT_DAYS,
  type LifeStage,
} from "@tinypet/shared";
import { Errors } from "./errors";
import { requireUser, requirePartner, assertPetAccess, type AuthUser, type PetAccessLevel } from "./auth";
import { notifyPartner } from "./notify";
import { awardBadge } from "./badges";

// ───────────────────────────── dates ─────────────────────────────

export const TZ = "America/Sao_Paulo";

/** "YYYY-MM-DD" of `now` in America/Sao_Paulo. */
export function todaySP(now = new Date()): string {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd");
}
/** "YYYY-MM-DD" of a timestamp seen from America/Sao_Paulo. */
export function spDate(d: Date): string {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}
/** Parses a `dateString` into the UTC-midnight Date used by `@db.Date` columns. */
export function dateOnly(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}
/** "YYYY-MM-DD" of a `@db.Date` value (stored as UTC midnight). */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function shiftDays(s: string, n: number): string {
  const d = dateOnly(s);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
/** Start of the given SP calendar day, as an absolute instant. */
export function spDayStart(dateStr: string): Date {
  // America/Sao_Paulo has no DST since 2019: fixed UTC-3.
  return new Date(`${dateStr}T00:00:00-03:00`);
}
export function spDayEnd(dateStr: string): Date {
  return new Date(spDayStart(dateStr).getTime() + 24 * 60 * 60 * 1000);
}

export function jsonInput(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (v === undefined) return undefined;
  if (v === null) return Prisma.JsonNull;
  return v as Prisma.InputJsonValue;
}

// ───────────────────────────── settings ─────────────────────────────

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return (row?.value as T | undefined) ?? fallback;
}

export async function weightAlertSetting() {
  const v = await getSetting<{ pct?: number; days?: number }>("weight_alert", {});
  return { pct: v.pct ?? WEIGHT_ALERT_PCT, days: v.days ?? WEIGHT_ALERT_DAYS };
}

// ───────────────────────────── life stage ─────────────────────────────

type StageRules = Record<string, { puppyUntil: number; seniorFrom: number }>;
let rulesCache: { at: number; rules: StageRules } | null = null;

/** Life-stage rules: admin rows (LifeStageRule) override the shared defaults. Cached for 60s. */
export async function lifeStageRules(): Promise<StageRules> {
  if (rulesCache && Date.now() - rulesCache.at < 60_000) return rulesCache.rules;
  const rows = await prisma.lifeStageRule.findMany({ include: { species: { select: { key: true } } } });
  const rules: StageRules = { ...DEFAULT_LIFE_STAGE_RULES };
  for (const r of rows) {
    const key = r.size ? `${r.species.key}:${r.size}` : r.species.key;
    rules[key] = { puppyUntil: r.puppyUntilMonths, seniorFrom: r.seniorFromMonths };
  }
  rulesCache = { at: Date.now(), rules };
  return rules;
}

export type PetAgeInput = { birthDate: Date | null; approxAgeMonths: number | null; size?: PetSize | null; species: { key: string } };

export function petAgeMonths(pet: { birthDate: Date | null; approxAgeMonths: number | null }, now = new Date()): number | null {
  return ageInMonths(pet.birthDate, pet.approxAgeMonths, now);
}

export function petLifeStageSync(pet: PetAgeInput, rules: StageRules, now = new Date()): LifeStage | null {
  return lifeStageFor(petAgeMonths(pet, now), pet.species.key, pet.size ?? null, rules);
}

export async function petLifeStage(pet: PetAgeInput): Promise<LifeStage | null> {
  return petLifeStageSync(pet, await lifeStageRules());
}

// ───────────────────────────── access ─────────────────────────────

export type PetActor = {
  user: AuthUser;
  pet: { id: string; ownerId: string | null; status: "ACTIVE" | "DECEASED"; name: string; createdByPartnerId: string | null };
  via: "owner" | "family" | "partner";
  partnerId?: string;
};

/**
 * Resolves who is acting on a pet. With `X-Partner-Id` the request runs in partner context and the pet must be
 * linked (ClientPet) to one of that partner's clients; otherwise `assertPetAccess` (owner / shared account / partner member).
 * Shared accounts (`via: "family"`) only pass `VIEW` and `TASK` (mark tasks done); `EDIT` is 403 for them.
 */
export async function petActor(req: NextRequest, petId: string, level: PetAccessLevel = "VIEW"): Promise<PetActor> {
  const select = { id: true, ownerId: true, status: true, name: true, createdByPartnerId: true } as const;
  if (req.headers.get("x-partner-id")) {
    const ctx = await requirePartner(req);
    const pet = await prisma.pet.findFirst({
      where: { id: petId, deletedAt: null, clients: { some: { client: { partnerId: ctx.partnerId, deletedAt: null, partner: { deletedAt: null } } } } },
      select,
    });
    if (!pet) throw Errors.notFound("Pet não encontrado");
    return { user: ctx.user, pet, via: "partner", partnerId: ctx.partnerId };
  }
  const user = await requireUser(req);
  const a = await assertPetAccess(user.id, petId, level);
  const pet = await prisma.pet.findUniqueOrThrow({ where: { id: petId }, select });
  return { user, pet, via: a.via, partnerId: a.via === "partner" ? a.partnerId : undefined };
}

/**
 * Owner-controlled data (pet profile, deceased flag): the owner always; shared accounts never; a partner only for pets
 * it created that have no owner yet (`createdByPartnerId === partnerId && ownerId === null`).
 */
export function canEditOwnerControlled(actor: PetActor): boolean {
  if (actor.via === "owner") return true;
  if (actor.via === "family") return false;
  return actor.pet.ownerId === null && !!actor.partnerId && actor.pet.createdByPartnerId === actor.partnerId;
}

export function assertOwnerControlled(actor: PetActor, msg = "Apenas o tutor pode alterar estes dados do pet") {
  if (!canEditOwnerControlled(actor)) throw Errors.forbidden(msg);
}

/** Partners may only edit/delete rows they created themselves (rows with partnerId null belong to owner/family). */
export function assertPartnerOwnsRow(actor: PetActor, rowPartnerId: string | null | undefined, msg = "Registro do tutor ou de outro parceiro não pode ser alterado") {
  if (actor.via === "partner" && (!rowPartnerId || rowPartnerId !== actor.partnerId)) throw Errors.forbidden(msg);
}

/** Throws 403 unless the actor is the pet's owner (shared accounts and partners can't). */
export function assertPetOwner(actor: PetActor, msg = "Apenas o tutor dono do pet pode fazer isso") {
  if (actor.via !== "owner") throw Errors.forbidden(msg);
}

/** "owner" | "shared" | "partner" as exposed by the API (`pet.role`). */
export function petRole(actor: Pick<PetActor, "via">): "owner" | "shared" | "partner" {
  return actor.via === "owner" ? "owner" : actor.via === "family" ? "shared" : "partner";
}

/** Pets the user owns or can see through PetAccess. */
export function myPetsWhere(userId: string, includeDeceased = false): Prisma.PetWhereInput {
  return {
    deletedAt: null,
    ...(includeDeceased ? {} : { status: "ACTIVE" }),
    OR: [{ ownerId: userId }, { accesses: { some: { userId } } }],
  };
}

export async function myPetIds(userId: string, includeDeceased = false): Promise<string[]> {
  const rows = await prisma.pet.findMany({ where: myPetsWhere(userId, includeDeceased), select: { id: true } });
  return rows.map((r) => r.id);
}

/** Pets counted against the owner's Free limit. */
export function ownerPetCount(userId: string) {
  return prisma.pet.count({ where: { ownerId: userId, createdByPartnerId: null, status: "ACTIVE", deletedAt: null } });
}

export const petInclude = {
  species: { select: { id: true, key: true, label: true } },
  breed: { select: { id: true, name: true, isMixed: true, isOther: true } },
  owner: { select: { id: true, name: true, username: true, avatarUrl: true } },
} satisfies Prisma.PetInclude;

export async function speciesByKey(key: string) {
  const s = await prisma.species.findUnique({ where: { key } });
  if (!s || !s.active) throw Errors.badRequest("Espécie inválida");
  return s;
}

/** Maps a petSchema body into Prisma data (resolves speciesKey, converts dates). */
export async function petData(body: {
  name?: string;
  speciesKey?: string;
  breedId?: string | null;
  breedOther?: string | null;
  color?: string | null;
  sex?: "MALE" | "FEMALE" | null;
  size?: PetSize | null;
  birthDate?: string | null;
  approxAgeMonths?: number | null;
  neutered?: boolean | null;
  microchip?: string | null;
  avatarUrl?: string | null;
  temperament?: string | null;
  specialCare?: string | null;
  feedingNotes?: string | null;
}) {
  const { speciesKey, birthDate, breedId, ...rest } = body;
  const data: Prisma.PetUncheckedUpdateInput = { ...rest };
  if (speciesKey !== undefined) data.speciesId = (await speciesByKey(speciesKey)).id;
  if (birthDate !== undefined) data.birthDate = birthDate ? dateOnly(birthDate) : null;
  if (breedId !== undefined) {
    if (breedId) {
      const breed = await prisma.breed.findUnique({ where: { id: breedId } });
      if (!breed) throw Errors.badRequest("Raça inválida");
      if (data.speciesId && breed.speciesId !== data.speciesId) throw Errors.badRequest("Raça não pertence à espécie");
    }
    data.breedId = breedId;
  }
  return data;
}

export async function petWithAge(petId: string) {
  const pet = await prisma.pet.findFirst({ where: { id: petId, deletedAt: null }, include: petInclude });
  if (!pet) throw Errors.notFound("Pet não encontrado");
  const months = petAgeMonths(pet);
  return { ...pet, ageMonths: months, ageLabel: formatAge(months), lifeStage: await petLifeStage(pet) };
}

// ───────────────────────────── deceased ─────────────────────────────

export async function markDeceased(petId: string, input: { deceasedAt: string; memorialNote?: string | null }, canceledBy: "OWNER" | "PARTNER" = "OWNER") {
  const pet = await prisma.pet.findUniqueOrThrow({ where: { id: petId }, select: { id: true, name: true } });
  const now = new Date();
  const future = await prisma.appointment.findMany({
    where: { startsAt: { gt: now }, status: { in: ["REQUESTED", "CONFIRMED"] }, pets: { some: { petId } } },
    select: { id: true, partnerId: true, startsAt: true },
  });
  await prisma.$transaction([
    prisma.appointment.updateMany({
      where: { id: { in: future.map((a) => a.id) } },
      data: { status: "CANCELED", canceledBy, cancelReason: "Pet falecido" },
    }),
    prisma.task.updateMany({ where: { petId, status: { in: ["ACTIVE", "PROPOSED"] } }, data: { status: "PAUSED" } }),
    prisma.pet.update({
      where: { id: petId },
      data: { status: "DECEASED", deceasedAt: dateOnly(input.deceasedAt), memorialNote: input.memorialNote ?? null, streakDays: 0 },
    }),
  ]);
  const partnerIds = Array.from(new Set(future.map((a) => a.partnerId)));
  await Promise.all(
    partnerIds.map((partnerId) =>
      notifyPartner(partnerId, {
        type: "pet_deceased",
        title: `${pet.name} faleceu`,
        body: `Os agendamentos futuros de ${pet.name} foram cancelados. Contratos em aberto não foram alterados.`,
        data: { petId },
      }),
    ),
  );
  return { canceledAppointments: future.length };
}

// ───────────────────────────── tasks & streaks ─────────────────────────────

export type TaskRule = { freq?: "daily" | "weekly" | "monthly" | string; days?: number[]; times?: string[]; dayOfMonth?: number } | null;
type TaskLike = { rule: unknown; dueAt: Date | null; createdAt: Date; status: string };

/** Whether a task is due on the given SP calendar day. */
export function isTaskDueOn(task: TaskLike, dateStr: string): boolean {
  if (task.status !== "ACTIVE") return false;
  if (spDate(task.createdAt) > dateStr) return false;
  const rule = task.rule as TaskRule;
  if (!rule || !rule.freq) {
    // one-off: pending from its due date until completed (status DONE)
    return task.dueAt ? spDate(task.dueAt) <= dateStr : true;
  }
  const d = dateOnly(dateStr);
  const created = dateOnly(spDate(task.createdAt));
  if (rule.freq === "daily") return true;
  if (rule.freq === "weekly") {
    const days = rule.days?.length ? rule.days : [created.getUTCDay()];
    return days.includes(d.getUTCDay());
  }
  if (rule.freq === "monthly") return d.getUTCDate() === (rule.dayOfMonth ?? created.getUTCDate());
  return false;
}

/** Tasks due on `dateStr` for the given pets, with the completion (if any) for that day. */
export async function tasksForDate(petIds: string[], dateStr: string) {
  if (!petIds.length) return [];
  const tasks = await prisma.task.findMany({
    where: { petId: { in: petIds }, status: "ACTIVE" },
    include: {
      pet: { select: { id: true, name: true, avatarUrl: true } },
      proposedByPartner: { select: { id: true, tradeName: true } },
      completions: { where: { forDate: dateOnly(dateStr) }, include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return tasks
    .filter((t) => isTaskDueOn(t, dateStr))
    .map(({ completions, ...t }) => ({
      ...t,
      forDate: dateStr,
      completed: completions.length > 0,
      completedAt: completions[0]?.completedAt ?? null,
      completedBy: completions[0]?.user ?? null,
    }));
}

/** True when every task due on that day for the pet is completed (or nothing was due). */
export async function allDueDone(petId: string, dateStr: string): Promise<boolean> {
  const due = await tasksForDate([petId], dateStr);
  return due.every((t) => t.completed);
}

export async function completeTask(taskId: string, petId: string, userId: string, forDate: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, petId } });
  if (!task) throw Errors.notFound("Tarefa não encontrada");
  if (task.status !== "ACTIVE") throw Errors.badRequest("A tarefa não está ativa");
  const wasAllDone = await allDueDone(petId, forDate);
  const completion = await prisma.taskCompletion.upsert({
    where: { taskId_forDate: { taskId, forDate: dateOnly(forDate) } },
    update: { userId, completedAt: new Date() },
    create: { taskId, userId, forDate: dateOnly(forDate) },
  });
  const rule = task.rule as TaskRule;
  if (!rule || !rule.freq) await prisma.task.update({ where: { id: taskId }, data: { status: "DONE" } });

  let streakDays: number | null = null;
  if (forDate === todaySP() && !wasAllDone && (await allDueDone(petId, forDate))) {
    const pet = await prisma.pet.findUniqueOrThrow({ where: { id: petId }, select: { streakDays: true, status: true } });
    const yesterdayDone = await allDueDone(petId, shiftDays(forDate, -1));
    streakDays = yesterdayDone && pet.streakDays > 0 ? pet.streakDays + 1 : 1;
    await prisma.pet.update({ where: { id: petId }, data: { streakDays } });
    if (streakDays >= 30) await awardBadge(petId, "iron_routine");
  }
  return { completion, streakDays };
}

// ───────────────────────────── measurements ─────────────────────────────

export async function partnerHasType(partnerId: string, typeKey: string) {
  const link = await prisma.partnerTypeLink.findFirst({ where: { partnerId, type: { key: typeKey } } });
  return !!link;
}

export async function measurementsFor(petId: string, period: "6m" | "1y" | "all") {
  const pet = await petWithAge(petId);
  const now = new Date();
  const from = period === "all" ? undefined : new Date(now.getFullYear() - (period === "1y" ? 1 : 0), now.getMonth() - (period === "6m" ? 6 : 0), now.getDate());
  const items = await prisma.bodyMeasurement.findMany({
    where: { petId, ...(from ? { measuredAt: { gte: from } } : {}) },
    orderBy: { measuredAt: "asc" },
    include: { user: { select: { id: true, name: true } }, partner: { select: { id: true, tradeName: true } } },
  });

  const lifeStage = pet.lifeStage;
  // minG/maxG: aliases read by the tutor web and mobile charts (same values as minWeightG/maxWeightG)
  let reference: { minWeightG: number; maxWeightG: number; minG: number; maxG: number; source: "breed" | "size" | "species" } | null = null;
  if (lifeStage) {
    const refs = await prisma.measurementReference.findMany({ where: { speciesId: pet.speciesId, lifeStage } });
    const byBreed = pet.breedId ? refs.find((r) => r.breedId === pet.breedId) : undefined;
    const bySize = pet.size ? refs.find((r) => !r.breedId && r.size === pet.size) : undefined;
    const generic = refs.find((r) => !r.breedId && !r.size);
    const r = byBreed ?? bySize ?? generic;
    if (r) reference = { minWeightG: r.minWeightG, maxWeightG: r.maxWeightG, minG: r.minWeightG, maxG: r.maxWeightG, source: byBreed ? "breed" : bySize ? "size" : "species" };
  }

  const alerts = await weightAlerts(items.map((m) => ({ measuredAt: m.measuredAt, weightG: m.weightG })));
  return { pet, items, lifeStage, reference, alerts };
}

export type WeightAlert = { type: "weight_change"; pct: number; fromWeightG: number; toWeightG: number; fromDate: string; toDate: string; days: number; direction: "gain" | "loss"; message: string };

/** pt-BR text shown by every client (tutor web, partner panel, mobile). */
export function weightAlertMessage(a: Pick<WeightAlert, "pct" | "days" | "direction" | "fromWeightG" | "toWeightG">): string {
  const kg = (g: number) => `${(g / 1000).toFixed(1).replace(".", ",")} kg`;
  const pct = String(Math.abs(a.pct)).replace(".", ",");
  return `${a.direction === "gain" ? "Ganho" : "Perda"} de ${pct}% de peso em até ${a.days} dias (${kg(a.fromWeightG)} → ${kg(a.toWeightG)}). Converse com o veterinário.`;
}

/** Weight change above `settings.weight_alert.pct` within `.days`, comparing the latest measurement with the oldest inside the window. */
export async function weightAlerts(items: { measuredAt: Date; weightG: number }[]): Promise<WeightAlert[]> {
  if (items.length < 2) return [];
  const { pct, days } = await weightAlertSetting();
  const sorted = [...items].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  const latest = sorted[sorted.length - 1]!;
  const windowStart = latest.measuredAt.getTime() - days * 86_400_000;
  const base = sorted.find((m) => m.measuredAt.getTime() >= windowStart && m !== latest);
  if (!base || base.weightG === 0) return [];
  const change = ((latest.weightG - base.weightG) / base.weightG) * 100;
  if (Math.abs(change) <= pct) return [];
  const alert: Omit<WeightAlert, "message"> = {
    type: "weight_change",
    pct: Math.round(change * 10) / 10,
    fromWeightG: base.weightG,
    toWeightG: latest.weightG,
    fromDate: ymd(base.measuredAt),
    toDate: ymd(latest.measuredAt),
    days,
    direction: change > 0 ? "gain" : "loss",
  };
  return [{ ...alert, message: weightAlertMessage(alert) }];
}

export function measurementsHtml(data: Awaited<ReturnType<typeof measurementsFor>>) {
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const fmt = (v: unknown) => (v == null ? "—" : String(v));
  const rows = data.items
    .map(
      (m) => `<tr>
  <td>${ymd(m.measuredAt).split("-").reverse().join("/")}</td>
  <td>${(m.weightG / 1000).toFixed(2)} kg</td>
  <td>${fmt(m.heightCm)}</td><td>${fmt(m.lengthCm)}</td><td>${fmt(m.neckCm)}</td><td>${fmt(m.chestCm)}</td><td>${fmt(m.abdomenCm)}</td><td>${fmt(m.bodyScore)}</td>
  <td>${m.partner ? `${esc(m.partner.tradeName)}${m.vetVerified ? " ✔ aferido por veterinário" : ""}` : esc(m.user?.name ?? "Tutor")}</td>
  <td>${esc(m.notes)}</td>
</tr>`,
    )
    .join("");
  const ref = data.reference ? `<p>Faixa de referência (${data.lifeStage}): ${(data.reference.minWeightG / 1000).toFixed(1)}–${(data.reference.maxWeightG / 1000).toFixed(1)} kg</p>` : "";
  const alerts = data.alerts.map((a) => `<p class="alert">Alerta: variação de peso de ${a.pct}% em ${a.days} dias (${a.fromDate} → ${a.toDate}).</p>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Peso e medidas — ${esc(data.pet.name)}</title>
<style>body{font-family:Inter,Arial,sans-serif;color:#242833;padding:24px;max-width:960px;margin:0 auto}h1{color:#f95d16;margin:0 0 4px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #d9dee8;padding:6px 8px;text-align:left}th{background:#f4f6fa}.alert{color:#b42318}.muted{color:#8792a8}@media print{button{display:none}}</style></head>
<body><h1>tinyPet</h1><h2>${esc(data.pet.name)} — histórico de peso e medidas</h2>
<p class="muted">${esc(data.pet.species.label)}${data.pet.breed ? ` · ${esc(data.pet.breed.name)}` : ""} · ${esc(data.pet.ageLabel)}${data.lifeStage ? ` · ${data.lifeStage}` : ""}</p>
${ref}${alerts}
<table><thead><tr><th>Data</th><th>Peso</th><th>Altura (cm)</th><th>Compr. (cm)</th><th>Pescoço (cm)</th><th>Tórax (cm)</th><th>Abdômen (cm)</th><th>ECC</th><th>Registrado por</th><th>Obs.</th></tr></thead><tbody>${rows}</tbody></table>
<p class="muted">Gerado em ${formatInTimeZone(new Date(), TZ, "dd/MM/yyyy HH:mm")}</p><button onclick="window.print()">Imprimir / salvar PDF</button></body></html>`;
}

// ───────────────────────────── foods ─────────────────────────────

export async function foodSuggestions(petId: string) {
  const pet = await prisma.pet.findUniqueOrThrow({
    where: { id: petId },
    select: { ownerId: true, foods: { where: { brandId: { not: null }, offersEnabled: true }, select: { brandId: true } } },
  });
  const brandIds = Array.from(new Set(pet.foods.map((f) => f.brandId!).filter(Boolean)));
  if (!brandIds.length) return { origin: null, partners: [] };
  const origin = pet.ownerId
    ? await prisma.address.findFirst({ where: { userId: pet.ownerId, isPrimary: true, latitude: { not: null }, longitude: { not: null } }, select: { latitude: true, longitude: true } })
    : null;
  const items = await prisma.catalogItem.findMany({
    where: { brandId: { in: brandIds }, status: "PUBLISHED", deletedAt: null, partner: { published: true, deletedAt: null } },
    include: {
      brand: { select: { id: true, name: true } },
      productLine: { select: { id: true, name: true } },
      partner: {
        select: {
          id: true,
          slug: true,
          tradeName: true,
          logoUrl: true,
          ratingAvg: true,
          types: { select: { type: { select: { key: true, label: true } } } },
          addresses: { where: { isPrimary: true }, select: { city: true, state: true, latitude: true, longitude: true }, take: 1 },
        },
      },
    },
  });
  const now = new Date();
  const lat = origin?.latitude != null ? Number(origin.latitude) : null;
  const lng = origin?.longitude != null ? Number(origin.longitude) : null;
  const byPartner = new Map<string, { partner: unknown; distanceKm: number | null; items: unknown[]; offers: unknown[] }>();
  for (const it of items) {
    const p = it.partner;
    let entry = byPartner.get(p.id);
    if (!entry) {
      const addr = p.addresses[0];
      const distanceKm =
        lat != null && lng != null && addr?.latitude != null && addr?.longitude != null
          ? Math.round(haversineKm(lat, lng, Number(addr.latitude), Number(addr.longitude)) * 10) / 10
          : null;
      entry = {
        partner: { id: p.id, slug: p.slug, tradeName: p.tradeName, logoUrl: p.logoUrl, ratingAvg: p.ratingAvg, types: p.types.map((t) => t.type), city: addr?.city ?? null, state: addr?.state ?? null },
        distanceKm,
        items: [],
        offers: [],
      };
      byPartner.set(p.id, entry);
    }
    const promoActive = it.promoPrice != null && (!it.promoUntil || it.promoUntil > now);
    const summary = { id: it.id, name: it.name, price: it.price, promoPrice: promoActive ? it.promoPrice : null, promoUntil: promoActive ? it.promoUntil : null, brand: it.brand, productLine: it.productLine };
    entry.items.push(summary);
    if (promoActive) entry.offers.push(summary);
  }
  const partners = Array.from(byPartner.values()).sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0;
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
  return { origin: lat != null && lng != null ? { lat, lng } : null, partners };
}

// ───────────────────────────── report card & milestones ─────────────────────────────

export async function reportCard(petId: string) {
  const pet = await petWithAge(petId);
  const today = todaySP();
  let nextBirthday: string | null = null;
  let daysUntil: number | null = null;
  let turning: number | null = null;
  if (pet.birthDate) {
    const b = ymd(pet.birthDate);
    const [, mm, dd] = b.split("-");
    const year = Number(today.slice(0, 4));
    let candidate = `${year}-${mm}-${dd}`;
    if (candidate < today) candidate = `${year + 1}-${mm}-${dd}`;
    nextBirthday = candidate;
    daysUntil = Math.round((dateOnly(candidate).getTime() - dateOnly(today).getTime()) / 86_400_000);
    turning = Number(candidate.slice(0, 4)) - Number(b.slice(0, 4));
  }
  const [ownerTerm, badges, masteredSkills, streak] = await Promise.all([
    pet.ownerId ? prisma.user.findUnique({ where: { id: pet.ownerId }, select: { ownerTerm: { select: { label: true } } } }) : null,
    prisma.earnedBadge.count({ where: { petId } }),
    prisma.petSkill.count({ where: { petId, level: "MASTERED" } }),
    prisma.pet.findUnique({ where: { id: petId }, select: { streakDays: true } }),
  ]);
  return {
    badges,
    masteredSkills,
    streakDays: streak?.streakDays ?? 0,
    pet: { id: pet.id, name: pet.name, avatarUrl: pet.avatarUrl, species: pet.species, breed: pet.breed, birthDate: pet.birthDate ? ymd(pet.birthDate) : null },
    ageMonths: pet.ageMonths,
    ageLabel: pet.ageLabel,
    lifeStage: pet.lifeStage,
    nextBirthday,
    daysUntil,
    turning,
    isBirthdayToday: daysUntil === 0,
    owner: pet.owner ? { id: pet.owner.id, name: pet.owner.name, term: ownerTerm?.ownerTerm?.label ?? "Tutor" } : null,
    shareText: `${pet.name}${turning != null ? ` faz ${turning} ${turning === 1 ? "ano" : "anos"}` : ""} 🎉 #tinyPet`,
  };
}

export async function milestones(petId: string) {
  const pet = await prisma.pet.findUniqueOrThrow({ where: { id: petId }, select: { name: true, birthDate: true, avatarUrl: true } });
  const [media, badges] = await Promise.all([
    prisma.petMedia.findMany({ where: { petId, deletedAt: null, isStory: false, title: { not: null } }, orderBy: { takenAt: "desc" } }),
    prisma.earnedBadge.findMany({ where: { petId }, include: { badge: true } }),
  ]);
  const items: { type: "media" | "badge" | "birthday"; date: Date; title: string; description?: string | null; imageUrl?: string | null; data?: unknown }[] = [];
  for (const m of media) items.push({ type: "media", date: m.takenAt, title: m.title!, description: m.description, imageUrl: m.thumbUrl ?? m.url, data: { mediaId: m.id, kind: m.kind } });
  for (const b of badges) items.push({ type: "badge", date: b.earnedAt, title: b.badge.name, description: b.badge.description, imageUrl: b.badge.iconUrl, data: { badgeKey: b.badge.key } });
  if (pet.birthDate) {
    const today = todaySP();
    const b = ymd(pet.birthDate);
    const [, mm, dd] = b.split("-");
    for (let y = Number(b.slice(0, 4)); y <= Number(today.slice(0, 4)); y++) {
      const d = `${y}-${mm}-${dd}`;
      if (d > today) break;
      const age = y - Number(b.slice(0, 4));
      items.push({ type: "birthday", date: dateOnly(d), title: age === 0 ? `${pet.name} nasceu` : `${pet.name} fez ${age} ${age === 1 ? "ano" : "anos"}`, imageUrl: pet.avatarUrl, data: { age } });
    }
  }
  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  return items;
}

// ───────────────────────────── owner family ─────────────────────────────

type FamilyRow = { id: string; name: string; relationship: string | null; phone: string | null; email: string | null; canAuthorize: boolean; canPickUp: boolean; linkedUserId: string | null };

/**
 * Owner's family members for API responses. Never exposes `linkedUserId` (account-existence oracle); `hasAccount: true`
 * is only added when the member's e-mail belongs to an account this user already shared a pet with (PetAccess).
 */
export async function familyView(userId: string, rows: FamilyRow[]) {
  const emails = Array.from(new Set(rows.map((r) => r.email?.toLowerCase()).filter((e): e is string => !!e)));
  const shared = emails.length
    ? await prisma.petAccess.findMany({ where: { pet: { ownerId: userId, deletedAt: null }, user: { email: { in: emails }, deletedAt: null } }, select: { user: { select: { email: true } } } })
    : [];
  const withAccess = new Set(shared.map((s) => s.user.email.toLowerCase()));
  return rows.map(({ linkedUserId: _l, ...r }) => ({ ...r, ...(r.email && withAccess.has(r.email.toLowerCase()) ? { hasAccount: true } : {}) }));
}
