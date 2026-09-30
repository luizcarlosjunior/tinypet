import { rateLimit } from "./api";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma, type AppointmentStatus, type Recurrence, type LocationType, type Address } from "@/db";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { addDays, addMonths, mapsLinks, DEFAULT_TIMEZONE, type Slot, type AppointmentInput } from "@tinypet/shared";
import { Errors } from "./errors";
import { estimateTravel } from "./geo";
import { notify, notifyPartner } from "./notify";

/*
 * Scheduling domain.
 *
 * Pure helpers (no DB) live at the top so they can be unit-tested: day bounds in America/Sao_Paulo,
 * availability windows, interval subtraction, slot generation, conflict detection and recurrence dates.
 * DB-backed functions follow: computeSlots, checkConflicts, createAppointments, updateAppointment,
 * ensureTravelLeg / recomputeDayLegs, dayRoute, transitionAppointment and owner-side helpers.
 *
 * Reschedule flow: the owner calls POST /me/appointments/:id/reschedule → a NEW appointment is created with
 * status REQUESTED and `rescheduleOfId = <oldId>` (server-side only). When the partner confirms that new appointment
 * (POST /schedule/appointments/:id/status {status:"CONFIRMED"}), the old one is canceled with reason
 * "Remarcação solicitada" (canceledBy OWNER). Until then the old appointment stays as it was.
 */

// ───────────────────────────── pure helpers ─────────────────────────────

export const TZ = DEFAULT_TIMEZONE;
export const SLOT_STEP_MINUTES = 15;
const MIN = 60_000;

export type Interval = { start: number; end: number };
export type BusyBlock = Interval & { label: string };

/** Calendar date (YYYY-MM-DD) of an instant, in the app timezone. */
export function localDateStr(d: Date, tz = TZ) {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

export function formatLocal(d: Date, pattern = "dd/MM/yyyy 'às' HH:mm", tz = TZ) {
  return formatInTimeZone(d, tz, pattern);
}

/** Weekday (0 = Sunday) of a calendar date. */
export function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function nextDateStr(date: string, days = 1) {
  return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** [start, end) of the given calendar date in the app timezone. */
export function dayBounds(date: string, tz = TZ): { start: Date; end: Date } {
  return { start: fromZonedTime(`${date}T00:00:00`, tz), end: fromZonedTime(`${nextDateStr(date)}T00:00:00`, tz) };
}

/** Availability rows (weekday + "HH:MM") → concrete intervals for the given date. */
export function availabilityWindows(date: string, rows: { weekday: number; startsAt: string; endsAt: string }[], tz = TZ): Interval[] {
  const wd = weekdayOf(date);
  return rows
    .filter((r) => r.weekday === wd)
    .map((r) => ({ start: fromZonedTime(`${date}T${r.startsAt}:00`, tz).getTime(), end: fromZonedTime(`${date}T${r.endsAt}:00`, tz).getTime() }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);
}

/** Removes busy intervals from windows, returning the remaining free intervals. */
export function subtractBusy(windows: Interval[], busy: Interval[]): Interval[] {
  let free = windows.map((w) => ({ ...w }));
  for (const b of busy) {
    const next: Interval[] = [];
    for (const w of free) {
      if (b.end <= w.start || b.start >= w.end) {
        next.push(w);
        continue;
      }
      if (b.start > w.start) next.push({ start: w.start, end: b.start });
      if (b.end < w.end) next.push({ start: b.end, end: w.end });
    }
    free = next;
  }
  return free.sort((a, b) => a.start - b.start);
}

/** Free slots of `durationMinutes` on a `stepMinutes` grid inside (windows − busy). */
export function slotsFromWindows(opts: { windows: Interval[]; busy: Interval[]; durationMinutes: number; stepMinutes?: number; notBefore?: number }): Interval[] {
  const step = (opts.stepMinutes ?? SLOT_STEP_MINUTES) * MIN;
  const dur = opts.durationMinutes * MIN;
  const out: Interval[] = [];
  for (const f of subtractBusy(opts.windows, opts.busy)) {
    let s = Math.ceil(f.start / step) * step;
    if (opts.notBefore != null) s = Math.max(s, Math.ceil(opts.notBefore / step) * step);
    while (s + dur <= f.end) {
      out.push({ start: s, end: s + dur });
      s += step;
    }
  }
  return out;
}

export function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

export function findConflict<T extends Interval>(candidate: Interval, busy: T[]): T | null {
  return busy.find((b) => overlaps(candidate, b)) ?? null;
}

export function withinWindows(candidate: Interval, windows: Interval[]) {
  return windows.some((w) => candidate.start >= w.start && candidate.end <= w.end);
}

export type Cadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/** Occurrence dates for a recurrence. PACKAGE uses `packageCadence` (default weekly). */
export function recurrenceDates(start: Date, recurrence: Recurrence, occurrences = 1, packageCadence: Cadence = "WEEKLY"): Date[] {
  if (recurrence === "NONE") return [start];
  const cadence: Cadence = recurrence === "PACKAGE" ? packageCadence : recurrence;
  const out: Date[] = [];
  for (let i = 0; i < Math.max(1, occurrences); i++) {
    out.push(cadence === "MONTHLY" ? addMonths(start, i) : addDays(start, i * (cadence === "WEEKLY" ? 7 : 14)));
  }
  return out;
}

/** Busy block of an appointment: travel leg (if any) + appointment + buffer on both sides. */
export function appointmentBlock(a: { startsAt: Date; endsAt: Date; travelLeg?: { startsAt: Date } | null }, bufferMinutes: number, label = "Atendimento"): BusyBlock {
  const start = Math.min(a.startsAt.getTime(), a.travelLeg?.startsAt.getTime() ?? Infinity) - bufferMinutes * MIN;
  return { start, end: a.endsAt.getTime() + bufferMinutes * MIN, label };
}

export function coordsOf(addr: { latitude: unknown; longitude: unknown } | null | undefined): { lat: number; lng: number } | null {
  if (!addr || addr.latitude == null || addr.longitude == null) return null;
  const lat = Number(addr.latitude);
  const lng = Number(addr.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function addressText(a: Pick<Address, "street" | "number" | "district" | "city" | "state"> | null | undefined) {
  if (!a) return "";
  return [a.street, a.number, a.district, a.city, a.state].filter(Boolean).join(", ");
}

/** Nearest-neighbour ordering over a distance matrix; index 0 is the origin (fixed). */
export function nearestNeighborOrder(matrix: number[][]): number[] {
  const n = matrix.length - 1;
  const remaining = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const order: number[] = [];
  let cur = 0;
  while (remaining.size) {
    let best = -1;
    let bestD = Infinity;
    for (const j of remaining) {
      if (matrix[cur]![j]! < bestD) {
        bestD = matrix[cur]![j]!;
        best = j;
      }
    }
    order.push(best);
    remaining.delete(best);
    cur = best;
  }
  return order;
}

export function routeTotal(matrix: number[][], order: number[]): number {
  let total = 0;
  let cur = 0;
  for (const j of order) {
    total += matrix[cur]![j]!;
    cur = j;
  }
  return total;
}

// ───────────────────────────── DB-backed ─────────────────────────────

export const appointmentInclude = {
  pets: { include: { pet: { select: { id: true, name: true, avatarUrl: true, species: { select: { key: true, label: true } } } } } },
  // phones: partner agenda drawer (WhatsApp/call); blanked in decorateOwnerAppointment
  client: { select: { id: true, name: true, userId: true, phones: { select: { number: true, type: true, isPrimary: true }, orderBy: { isPrimary: "desc" as const } } } },
  item: { select: { id: true, name: true, durationMinutes: true, defaultLocation: true } },
  membership: { select: { id: true, jobTitle: true, user: { select: { id: true, name: true, avatarUrl: true } } } },
  address: true,
  travelLeg: true,
} satisfies Prisma.AppointmentInclude;

export type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

/** Flattens pets and adds navigation links (Google/Waze/Apple) for the appointment address. */
export function decorateAppointment(a: AppointmentRow) {
  const c = coordsOf(a.address);
  const text = addressText(a.address);
  return {
    ...a,
    pets: a.pets.map((p) => p.pet),
    links: a.address ? mapsLinks(c?.lat, c?.lng, text) : null,
    addressText: text || null,
  };
}

async function loadBusy(input: { partnerId: string; membershipId: string | null; from: Date; to: Date; bufferMinutes: number; excludeId?: string; excludeSeriesId?: string }): Promise<BusyBlock[]> {
  const where: Prisma.AppointmentWhereInput = {
    partnerId: input.partnerId,
    status: { not: "CANCELED" },
    startsAt: { lt: new Date(input.to.getTime() + 3 * 3_600_000) },
    endsAt: { gt: new Date(input.from.getTime() - 3 * 3_600_000) },
    ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    ...(input.membershipId ? { OR: [{ membershipId: input.membershipId }, { membershipId: null }] } : {}),
  };
  const [appts, offs] = await Promise.all([
    prisma.appointment.findMany({ where, include: { travelLeg: true, client: { select: { name: true } } } }),
    input.membershipId ? prisma.timeOff.findMany({ where: { membershipId: input.membershipId, startsAt: { lt: input.to }, endsAt: { gt: input.from } } }) : Promise.resolve([]),
  ]);
  const busy: BusyBlock[] = appts.map((a) => appointmentBlock(a, input.bufferMinutes, `${a.title ?? "Atendimento"}${a.client ? ` (${a.client.name})` : ""} às ${formatLocal(a.startsAt, "HH:mm")}`));
  for (const o of offs) busy.push({ start: o.startsAt.getTime(), end: o.endsAt.getTime(), label: `Bloqueio${o.reason ? `: ${o.reason}` : ""}` });
  return busy;
}

/** Free slots for an item on a day. Without membershipId, unions every member of the partner that has availability. */
export async function computeSlots(input: { partnerId: string; itemId: string; date: string; membershipId?: string }): Promise<Slot[]> {
  const [item, partner] = await Promise.all([
    prisma.catalogItem.findFirst({ where: { id: input.itemId, partnerId: input.partnerId, deletedAt: null }, select: { durationMinutes: true } }),
    prisma.partner.findFirst({ where: { id: input.partnerId, deletedAt: null }, select: { bufferMinutes: true } }),
  ]);
  if (!item || !partner) throw Errors.notFound("Serviço não encontrado");
  const duration = item.durationMinutes ?? 60;
  const memberships = await prisma.membership.findMany({
    where: { partnerId: input.partnerId, ...(input.membershipId ? { id: input.membershipId } : {}), availabilities: { some: {} } },
    include: { availabilities: true },
  });
  const { start, end } = dayBounds(input.date);
  const now = Date.now();
  const slots: Slot[] = [];
  for (const m of memberships) {
    const windows = availabilityWindows(input.date, m.availabilities);
    if (!windows.length) continue;
    const busy = await loadBusy({ partnerId: input.partnerId, membershipId: m.id, from: start, to: end, bufferMinutes: partner.bufferMinutes });
    for (const s of slotsFromWindows({ windows, busy, durationMinutes: duration, notBefore: now })) {
      slots.push({ startsAt: new Date(s.start).toISOString(), endsAt: new Date(s.end).toISOString(), membershipId: m.id });
    }
  }
  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.membershipId.localeCompare(b.membershipId));
}

export type ConflictCheck = { partnerId: string; membershipId: string | null; startsAt: Date; endsAt: Date; excludeId?: string; bufferMinutes?: number };

/** Returns a human-readable conflict reason or null when the interval is free (availability, time-offs, other appointments + legs + buffer). */
export async function findConflicts(input: ConflictCheck): Promise<string | null> {
  const buffer = input.bufferMinutes ?? (await prisma.partner.findUnique({ where: { id: input.partnerId }, select: { bufferMinutes: true } }))?.bufferMinutes ?? 0;
  const candidate: Interval = { start: input.startsAt.getTime(), end: input.endsAt.getTime() };
  const date = localDateStr(input.startsAt);
  if (input.membershipId) {
    const avail = await prisma.availability.findMany({ where: { membershipId: input.membershipId } });
    if (avail.length) {
      const windows = availabilityWindows(date, avail);
      if (!withinWindows(candidate, windows)) return `Fora do horário de trabalho do profissional em ${formatLocal(input.startsAt, "dd/MM")}`;
    }
  }
  const { start, end } = dayBounds(date);
  const busy = await loadBusy({ partnerId: input.partnerId, membershipId: input.membershipId, from: start, to: end, bufferMinutes: buffer, excludeId: input.excludeId });
  const hit = findConflict(candidate, busy);
  return hit ? `Conflito em ${formatLocal(input.startsAt, "dd/MM")}: ${hit.label}` : null;
}

/**
 * Throws 409 CONFLICT when the interval is not free. The detailed reason names other clients / staff time-off, so it
 * is only shown to the partner; tutors (bookings, reschedules) get a generic message.
 */
export async function checkConflicts(input: ConflictCheck, opts: { forPartner?: boolean } = { forPartner: true }) {
  const reason = await findConflicts(input);
  if (reason) throw Errors.conflict(opts.forPartner ? reason : "Horário indisponível. Escolha outro horário.");
}

// ───────── validation of references ─────────

type Refs = { clientId?: string | null; petIds?: string[]; membershipId?: string | null; itemId?: string | null; locationType?: LocationType; addressId?: string | null; contractId?: string | null };

async function resolveRefs(partnerId: string, refs: Refs, ownerUserId?: string | null) {
  const client = refs.clientId ? await prisma.client.findFirst({ where: { id: refs.clientId, partnerId, deletedAt: null }, select: { id: true, userId: true } }) : null;
  if (refs.clientId && !client) throw Errors.notFound("Cliente não encontrado");

  if (refs.petIds?.length) {
    const pets = await prisma.pet.findMany({
      where: {
        id: { in: refs.petIds },
        deletedAt: null,
        // owner-side requests: only pets the user owns (shared accounts can't book)
        OR: ownerUserId
          ? editablePetOr(ownerUserId)
          : [client ? { clients: { some: { clientId: client.id } } } : { clients: { some: { client: { partnerId, deletedAt: null } } } }, { createdByPartnerId: partnerId }],
      },
      select: { id: true },
    });
    if (pets.length !== new Set(refs.petIds).size) throw Errors.badRequest("Um ou mais pets não pertencem a este cliente");
  }

  if (refs.itemId) {
    const item = await prisma.catalogItem.findFirst({ where: { id: refs.itemId, partnerId, deletedAt: null }, select: { id: true } });
    if (!item) throw Errors.notFound("Serviço não encontrado");
  }

  if (refs.membershipId) {
    const m = await prisma.membership.findFirst({ where: { id: refs.membershipId, partnerId }, select: { id: true } });
    if (!m) throw Errors.notFound("Profissional não encontrado");
  }

  let addressId: string | null = refs.addressId ?? null;
  if (refs.locationType === "CLIENT_HOME") {
    if (!addressId) throw Errors.badRequest("Informe o endereço do cliente para atendimento a domicílio");
    const owners: Prisma.AddressWhereInput[] = [];
    if (client) owners.push({ clientId: client.id });
    if (client?.userId) owners.push({ userId: client.userId });
    if (ownerUserId) owners.push({ userId: ownerUserId });
    const addr = owners.length ? await prisma.address.findFirst({ where: { id: addressId, OR: owners }, select: { id: true } }) : null;
    if (!addr) throw Errors.badRequest("O endereço não pertence ao cliente");
  } else if (refs.locationType === "PARTNER_VENUE") {
    const primary = await prisma.address.findFirst({ where: { partnerId }, orderBy: { isPrimary: "desc" }, select: { id: true } });
    addressId = primary?.id ?? null;
  } else if (refs.locationType === "ONLINE") {
    addressId = null;
  } else if (addressId) {
    const addr = await prisma.address.findFirst({ where: { id: addressId, OR: [{ partnerId }, ...(client ? [{ clientId: client.id }] : []), ...(client?.userId ? [{ userId: client.userId }] : []), ...(ownerUserId ? [{ userId: ownerUserId }] : [])] }, select: { id: true } });
    if (!addr) throw Errors.badRequest("Endereço inválido");
  }
  if (refs.contractId) {
    const contract = await prisma.contract.findFirst({ where: { id: refs.contractId, partnerId, ...(client ? { clientId: client.id } : {}) }, select: { id: true } });
    if (!contract) throw Errors.badRequest("Contrato não pertence a este parceiro/cliente");
  }
  return { client, addressId };
}

/** Pets a user may act on (book, cancel, reschedule): owned only — shared accounts are read-only. */
export function editablePetOr(userId: string): Prisma.PetWhereInput[] {
  return [{ ownerId: userId }];
}

// ───────── create / update ─────────

export type CreateCtx = {
  partnerId: string;
  userId: string;
  /** membership of the acting partner member (used as default professional) */
  membershipId?: string | null;
  byPartner: boolean;
  /** partner override: skips availability/time-off/overlap checks (e.g. group classes) */
  force?: boolean;
};

export type CreateInput = AppointmentInput & {
  status?: AppointmentStatus;
  requestedByUserId?: string | null;
  packageCadence?: Cadence;
  /** server-side only (owner reschedule); never taken from request bodies */
  rescheduleOfId?: string | null;
};

/** Creates one appointment or a recurring series (WEEKLY/BIWEEKLY/MONTHLY/PACKAGE × occurrences). */
export async function createAppointments(ctx: CreateCtx, input: CreateInput) {
  const partner = await prisma.partner.findFirst({ where: { id: ctx.partnerId, deletedAt: null }, select: { bufferMinutes: true } });
  if (!partner) throw Errors.notFound("Parceiro não encontrado");

  const { client, addressId } = await resolveRefs(ctx.partnerId, input, ctx.byPartner ? null : ctx.userId);

  let membershipId = input.membershipId ?? (ctx.byPartner ? ctx.membershipId ?? null : null);
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) throw Errors.badRequest("Data inválida");
  const durationMs = input.durationMinutes * MIN;

  if (!membershipId && !ctx.byPartner) {
    // booking: pick the first professional that is free at that time
    const members = await prisma.membership.findMany({ where: { partnerId: ctx.partnerId }, orderBy: [{ role: "asc" }, { createdAt: "asc" }], select: { id: true, availabilities: { select: { id: true } } } });
    const withAvail = members.filter((m) => m.availabilities.length);
    for (const m of withAvail.length ? withAvail : members) {
      const reason = await findConflicts({ partnerId: ctx.partnerId, membershipId: m.id, startsAt: start, endsAt: new Date(start.getTime() + durationMs), bufferMinutes: partner.bufferMinutes });
      if (!reason) {
        membershipId = m.id;
        break;
      }
    }
    if (!membershipId) throw Errors.conflict("Nenhum profissional disponível neste horário");
  }

  const recurrence = input.recurrence ?? "NONE";
  const occurrences = recurrence === "NONE" ? 1 : input.occurrences ?? 1;
  const dates = recurrenceDates(start, recurrence, occurrences, input.packageCadence);
  const seriesId = recurrence === "NONE" ? null : randomUUID();

  if (!ctx.force) {
    for (const d of dates) {
      await checkConflicts({ partnerId: ctx.partnerId, membershipId, startsAt: d, endsAt: new Date(d.getTime() + durationMs), bufferMinutes: partner.bufferMinutes }, { forPartner: ctx.byPartner });
    }
  }

  const status: AppointmentStatus = input.status ?? (ctx.byPartner ? "CONFIRMED" : "REQUESTED");
  const created = await prisma.$transaction(
    dates.map((d, i) =>
      prisma.appointment.create({
        data: {
          partnerId: ctx.partnerId,
          clientId: client?.id ?? null,
          membershipId,
          itemId: input.itemId ?? null,
          contractId: input.contractId ?? null,
          requestedByUserId: input.requestedByUserId ?? (ctx.byPartner ? null : ctx.userId),
          title: input.title ?? null,
          startsAt: d,
          endsAt: new Date(d.getTime() + durationMs),
          durationMinutes: input.durationMinutes,
          locationType: input.locationType,
          addressId,
          locationNotes: input.locationNotes ?? null,
          status,
          recurrence,
          seriesId,
          sessionNumber: seriesId ? i + 1 : null,
          notes: input.notes ?? null,
          rescheduleOfId: input.rescheduleOfId ?? null,
          pets: { create: input.petIds.map((petId) => ({ petId })) },
        },
        select: { id: true, startsAt: true },
      }),
    ),
  );

  const days = new Set(created.map((a) => localDateStr(a.startsAt)));
  for (const day of days) await recomputeDayLegs(ctx.partnerId, membershipId, day);

  const rows = await prisma.appointment.findMany({ where: { id: { in: created.map((c) => c.id) } }, include: appointmentInclude, orderBy: { startsAt: "asc" } });
  return rows.map(decorateAppointment);
}

export type UpdateInput = Partial<AppointmentInput>;

export async function updateAppointment(ctx: CreateCtx, id: string, patch: UpdateInput) {
  const current = await prisma.appointment.findFirst({ where: { id, partnerId: ctx.partnerId } });
  if (!current) throw Errors.notFound("Agendamento não encontrado");
  if (current.status === "CANCELED" || current.status === "COMPLETED") throw Errors.badRequest("Agendamento encerrado não pode ser alterado");
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: ctx.partnerId }, select: { bufferMinutes: true } });

  const locationType = patch.locationType ?? current.locationType;
  const clientId = patch.clientId === undefined ? current.clientId : patch.clientId;
  const { addressId } = await resolveRefs(ctx.partnerId, {
    clientId,
    petIds: patch.petIds,
    membershipId: patch.membershipId ?? undefined,
    itemId: patch.itemId ?? undefined,
    locationType,
    addressId: patch.addressId === undefined ? current.addressId : patch.addressId,
    contractId: patch.contractId !== undefined || patch.clientId !== undefined ? (patch.contractId === undefined ? current.contractId : patch.contractId) : undefined,
  });

  const membershipId = patch.membershipId === undefined ? current.membershipId : patch.membershipId;
  const startsAt = patch.startsAt ? new Date(patch.startsAt) : current.startsAt;
  const durationMinutes = patch.durationMinutes ?? current.durationMinutes;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * MIN);
  const timeChanged = startsAt.getTime() !== current.startsAt.getTime() || durationMinutes !== current.durationMinutes || membershipId !== current.membershipId;
  if (timeChanged && !ctx.force) {
    await checkConflicts({ partnerId: ctx.partnerId, membershipId, startsAt, endsAt, excludeId: id, bufferMinutes: partner.bufferMinutes });
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id },
      data: {
        clientId,
        membershipId,
        itemId: patch.itemId === undefined ? current.itemId : patch.itemId,
        contractId: patch.contractId === undefined ? current.contractId : patch.contractId,
        title: patch.title === undefined ? current.title : patch.title,
        startsAt,
        endsAt,
        durationMinutes,
        locationType,
        addressId,
        locationNotes: patch.locationNotes === undefined ? current.locationNotes : patch.locationNotes,
        notes: patch.notes === undefined ? current.notes : patch.notes,
      },
    });
    if (patch.petIds) {
      await tx.appointmentPet.deleteMany({ where: { appointmentId: id } });
      await tx.appointmentPet.createMany({ data: patch.petIds.map((petId) => ({ appointmentId: id, petId })) });
    }
  });

  const days = new Set([localDateStr(current.startsAt), localDateStr(startsAt)]);
  const members = new Set([current.membershipId, membershipId]);
  for (const day of days) for (const m of members) await recomputeDayLegs(ctx.partnerId, m, day);

  const row = await prisma.appointment.findUniqueOrThrow({ where: { id }, include: appointmentInclude });
  return decorateAppointment(row);
}

// ───────── travel legs ─────────

/**
 * (Re)computes the TravelLeg that precedes a CLIENT_HOME appointment. Origin = previous appointment of the same
 * professional on the same day (its address), else the membership base address, else the partner primary address.
 */
export async function ensureTravelLeg(appointmentId: string) {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { address: true, membership: { select: { baseAddressId: true } }, partner: { select: { addresses: { orderBy: { isPrimary: "desc" }, take: 1 } } } },
  });
  if (!a) return null;
  const to = coordsOf(a.address);
  if (a.locationType !== "CLIENT_HOME" || !to || a.status === "CANCELED") {
    await prisma.travelLeg.deleteMany({ where: { toAppointmentId: appointmentId } });
    return null;
  }
  const { start } = dayBounds(localDateStr(a.startsAt));
  const prev = await prisma.appointment.findFirst({
    where: { partnerId: a.partnerId, id: { not: a.id }, membershipId: a.membershipId, status: { not: "CANCELED" }, startsAt: { gte: start, lt: a.startsAt }, addressId: { not: null } },
    orderBy: { startsAt: "desc" },
    include: { address: true },
  });
  let fromAddr: Address | null = prev?.address ?? null;
  if (!coordsOf(fromAddr) && a.membership?.baseAddressId) fromAddr = await prisma.address.findUnique({ where: { id: a.membership.baseAddressId } });
  if (!coordsOf(fromAddr)) fromAddr = a.partner.addresses[0] ?? null;
  const from = coordsOf(fromAddr);
  if (!from || !fromAddr) {
    await prisma.travelLeg.deleteMany({ where: { toAppointmentId: appointmentId } });
    return null;
  }
  const est = await estimateTravel(from, to, a.startsAt);
  const data = {
    fromAddressId: fromAddr.id,
    distanceKm: est.distanceKm,
    durationMinutes: est.durationMinutes,
    estimated: est.estimated,
    startsAt: new Date(a.startsAt.getTime() - est.durationMinutes * MIN),
    endsAt: a.startsAt,
  };
  return prisma.travelLeg.upsert({ where: { toAppointmentId: a.id }, create: { toAppointmentId: a.id, ...data }, update: data });
}

/** Recomputes every leg of a professional's day (legs depend on the previous stop, so inserts/moves shift the next one). */
export async function recomputeDayLegs(partnerId: string, membershipId: string | null, date: string) {
  const { start, end } = dayBounds(date);
  const rows = await prisma.appointment.findMany({ where: { partnerId, membershipId, startsAt: { gte: start, lt: end } }, orderBy: { startsAt: "asc" }, select: { id: true } });
  for (const r of rows) await ensureTravelLeg(r.id);
}

// ───────── agenda listing ─────────

export function rangeFromQuery(from: string, to: string): { from: Date; to: Date } {
  const f = /^\d{4}-\d{2}-\d{2}$/.test(from) ? dayBounds(from).start : new Date(from);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(to) ? dayBounds(to).end : new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || t <= f) throw Errors.badRequest("Período inválido");
  return { from: f, to: t };
}

export async function listAgenda(partnerId: string, q: { from: string; to: string; membershipId?: string; clientId?: string; status?: AppointmentStatus; locationType?: LocationType }) {
  const { from, to } = rangeFromQuery(q.from, q.to);
  const rows = await prisma.appointment.findMany({
    where: { partnerId, startsAt: { lt: to }, endsAt: { gt: from }, ...(q.membershipId ? { membershipId: q.membershipId } : {}), ...(q.clientId ? { clientId: q.clientId } : {}), ...(q.status ? { status: q.status } : {}), ...(q.locationType ? { locationType: q.locationType } : {}) },
    include: appointmentInclude,
    orderBy: { startsAt: "asc" },
  });
  return rows.map(decorateAppointment);
}

// ───────── day route ─────────

export async function dayRoute(partnerId: string, membershipId: string, date: string) {
  const membership = await prisma.membership.findFirst({ where: { id: membershipId, partnerId }, include: { partner: { select: { travelSlackMinutes: true, addresses: { orderBy: { isPrimary: "desc" }, take: 1 } } } } });
  if (!membership) throw Errors.notFound("Profissional não encontrado");
  const { start, end } = dayBounds(date);
  const rows = await prisma.appointment.findMany({
    where: { partnerId, membershipId, status: { not: "CANCELED" }, locationType: "CLIENT_HOME", startsAt: { gte: start, lt: end } },
    include: appointmentInclude,
    orderBy: { startsAt: "asc" },
  });
  const baseAddr = (membership.baseAddressId ? await prisma.address.findUnique({ where: { id: membership.baseAddressId } }) : null) ?? membership.partner.addresses[0] ?? null;
  const origin = coordsOf(baseAddr);
  const slack = membership.partner.travelSlackMinutes;

  type Stop = {
    appointmentId: string;
    order: number;
    clientName: string | null;
    title: string | null;
    address: Address | null;
    addressText: string | null;
    lat: number | null;
    lng: number | null;
    startsAt: Date;
    endsAt: Date;
    legDistanceKm: number;
    legMinutes: number;
    estimated: boolean;
    links: ReturnType<typeof mapsLinks> | null;
    alert: { delayMinutes: number; message: string } | null;
  };

  const stops: Stop[] = [];
  let prevCoords = origin;
  let prevEnd: Date | null = null;
  let totalKm = 0;
  let totalMinutes = 0;
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]!;
    const c = coordsOf(a.address);
    let legKm = 0;
    let legMin = 0;
    let estimated = true;
    if (a.travelLeg) {
      legKm = Number(a.travelLeg.distanceKm);
      legMin = a.travelLeg.durationMinutes;
      estimated = a.travelLeg.estimated;
    } else if (prevCoords && c) {
      const est = await estimateTravel(prevCoords, c, a.startsAt);
      legKm = est.distanceKm;
      legMin = est.durationMinutes;
      estimated = est.estimated;
    }
    totalKm += legKm;
    totalMinutes += legMin;
    let alert: Stop["alert"] = null;
    if (prevEnd) {
      const gap = Math.round((a.startsAt.getTime() - prevEnd.getTime()) / MIN);
      if (gap < legMin + slack) alert = { delayMinutes: legMin + slack - gap, message: `Atraso previsto de ${legMin + slack - gap} min: intervalo de ${gap} min para ${legMin} min de percurso + ${slack} min de folga` };
    }
    stops.push({
      appointmentId: a.id,
      order: i + 1,
      clientName: a.client?.name ?? null,
      title: a.title ?? a.item?.name ?? null,
      address: a.address,
      addressText: addressText(a.address) || null,
      lat: c?.lat ?? null,
      lng: c?.lng ?? null,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      legDistanceKm: Math.round(legKm * 10) / 10,
      legMinutes: legMin,
      estimated,
      links: a.address ? mapsLinks(c?.lat, c?.lng, addressText(a.address)) : null,
      alert,
    });
    if (c) prevCoords = c;
    prevEnd = a.endsAt;
  }

  const points = stops.filter((s) => s.lat != null && s.lng != null).map((s) => `${s.lat},${s.lng}`);
  let googleMapsUrl: string | null = null;
  if (points.length) {
    const originParam = origin ? `${origin.lat},${origin.lng}` : points[0]!;
    const rest = origin ? points : points.slice(1);
    const destination = rest[rest.length - 1] ?? originParam;
    const waypoints = rest.slice(0, -1);
    googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destination}${waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join("|"))}` : ""}&travelmode=driving`;
  }

  // Suggestions: shift late stops, and nearest-neighbour reorder (≤ 8 geocoded stops)
  const suggestions: Record<string, unknown>[] = [];
  for (let i = 1; i < stops.length; i++) {
    const s = stops[i]!;
    if (s.alert) {
      const suggested = new Date(stops[i - 1]!.endsAt.getTime() + (s.legMinutes + slack) * MIN);
      suggestions.push({ type: "SHIFT", appointmentId: s.appointmentId, suggestedStartsAt: suggested, message: `Adiar ${s.clientName ?? "atendimento"} para ${formatLocal(suggested, "HH:mm")} para caber o percurso (o tutor precisa aceitar)` });
    }
  }
  const geo = stops.filter((s) => s.lat != null && s.lng != null);
  if (origin && geo.length >= 2 && geo.length <= 8) {
    const pts = [origin, ...geo.map((s) => ({ lat: s.lat!, lng: s.lng! }))];
    const km: number[][] = [];
    const min: number[][] = [];
    for (let i = 0; i < pts.length; i++) {
      km.push([]);
      min.push([]);
      for (let j = 0; j < pts.length; j++) {
        if (i === j) {
          km[i]![j] = 0;
          min[i]![j] = 0;
          continue;
        }
        const est = await estimateTravel(pts[i]!, pts[j]!);
        km[i]![j] = est.distanceKm;
        min[i]![j] = est.durationMinutes;
      }
    }
    const currentOrder = geo.map((_, i) => i + 1);
    const nn = nearestNeighborOrder(km);
    const savesKm = Math.round((routeTotal(km, currentOrder) - routeTotal(km, nn)) * 10) / 10;
    const savesMinutes = routeTotal(min, currentOrder) - routeTotal(min, nn);
    if (savesKm >= 0.5 && nn.some((v, i) => v !== currentOrder[i])) {
      suggestions.push({
        type: "REORDER",
        order: nn.map((i) => geo[i - 1]!.appointmentId),
        savesKm,
        savesMinutes,
        message: `Reordenar as visitas economiza ${savesKm} km e ${savesMinutes} min (horários combinados precisam de aceite dos tutores)`,
      });
    }
  }

  const costPerKm = membership.costPerKm != null ? Number(membership.costPerKm) : null;
  return {
    date,
    membershipId,
    origin: baseAddr ? { addressId: baseAddr.id, addressText: addressText(baseAddr), lat: origin?.lat ?? null, lng: origin?.lng ?? null } : null,
    stops,
    totalKm: Math.round(totalKm * 10) / 10,
    totalMinutes,
    googleMapsUrl,
    suggestions,
    estimatedCost: costPerKm != null ? Math.round(totalKm * costPerKm * 100) / 100 : null,
    costPerKm,
  };
}

// ───────── status transitions ─────────

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  REQUESTED: ["CONFIRMED", "CANCELED"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
  NO_SHOW: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return TRANSITIONS[from].includes(to);
}

function ownerUserIdOf(a: { client: { userId: string | null } | null; requestedByUserId: string | null }) {
  return a.client?.userId ?? a.requestedByUserId ?? null;
}

export async function transitionAppointment(ctx: { partnerId: string; userId: string }, id: string, body: { status: AppointmentStatus; cancelReason?: string | null; report?: string | null; nextSteps?: string | null; reportPhotos?: string[] }) {
  const a = await prisma.appointment.findFirst({ where: { id, partnerId: ctx.partnerId }, include: appointmentInclude });
  if (!a) throw Errors.notFound("Agendamento não encontrado");
  if (!canTransition(a.status, body.status)) throw Errors.badRequest(`Transição inválida: ${a.status} → ${body.status}`);
  const ownerId = ownerUserIdOf(a);
  const when = formatLocal(a.startsAt);
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: ctx.partnerId }, select: { tradeName: true } });

  if (body.status === "CANCELED") {
    if (!body.cancelReason?.trim()) throw Errors.badRequest("Informe o motivo do cancelamento");
    await prisma.appointment.update({ where: { id }, data: { status: "CANCELED", cancelReason: body.cancelReason, canceledBy: "PARTNER" } });
    await recomputeDayLegs(ctx.partnerId, a.membershipId, localDateStr(a.startsAt));
    if (ownerId) await notify({ userId: ownerId, type: "appointment.canceled", title: "Agendamento cancelado", body: `${partner.tradeName} cancelou o atendimento de ${when}. Motivo: ${body.cancelReason}`, data: { appointmentId: id }, email: true });
  } else if (body.status === "COMPLETED") {
    const title = a.item?.name ?? a.title ?? "Atendimento";
    const description = [body.report, body.nextSteps ? `Próximos passos: ${body.nextSteps}` : null].filter(Boolean).join("\n\n") || null;
    const attachments = (body.reportPhotos ?? []).map((url, i) => ({ url, name: `Foto ${i + 1}`, type: "image" }));
    await prisma.$transaction([
      prisma.appointment.update({ where: { id }, data: { status: "COMPLETED", report: body.report ?? a.report, nextSteps: body.nextSteps ?? a.nextSteps, reportPhotos: body.reportPhotos ?? (a.reportPhotos as Prisma.InputJsonValue | undefined) } }),
      ...a.pets.map((p) =>
        prisma.petHistoryEvent.create({
          data: { petId: p.pet.id, type: "VISIT", title, description, occurredAt: a.startsAt, partnerId: ctx.partnerId, userId: ctx.userId, appointmentId: id, attachments: attachments.length ? attachments : undefined },
        }),
      ),
    ]);
    if (ownerId) await notify({ userId: ownerId, type: "appointment.completed", title: "Atendimento concluído", body: `${partner.tradeName} registrou o atendimento "${title}" de ${when} no histórico do pet.`, data: { appointmentId: id }, email: true });
  } else {
    await prisma.appointment.update({ where: { id }, data: { status: body.status } });
    if (body.status === "CONFIRMED") {
      // reschedule proposal accepted → cancel the original appointment (same partner AND same client/owner only)
      if (a.rescheduleOfId) {
        const old = await prisma.appointment.findFirst({
          where: { id: a.rescheduleOfId, partnerId: ctx.partnerId, status: { in: ["REQUESTED", "CONFIRMED"] } },
          include: { client: { select: { userId: true } } },
        });
        const sameClient = !!old && (a.clientId ? old.clientId === a.clientId : !!ownerId && ownerUserIdOf(old) === ownerId);
        if (old && sameClient) {
          await prisma.appointment.update({ where: { id: old.id }, data: { status: "CANCELED", cancelReason: "Remarcação solicitada", canceledBy: "OWNER" } });
          await recomputeDayLegs(ctx.partnerId, old.membershipId, localDateStr(old.startsAt));
        }
      }
      if (ownerId) await notify({ userId: ownerId, type: "appointment.confirmed", title: "Agendamento confirmado", body: `${partner.tradeName} confirmou seu atendimento de ${when}.`, data: { appointmentId: id }, email: true });
    } else if (body.status === "NO_SHOW" && ownerId) {
      await notify({ userId: ownerId, type: "appointment.no_show", title: "Não compareceu", body: `${partner.tradeName} registrou falta no atendimento de ${when}.`, data: { appointmentId: id } });
    }
  }
  const row = await prisma.appointment.findUniqueOrThrow({ where: { id }, include: appointmentInclude });
  return decorateAppointment(row);
}

/** Hard-deletes a non-completed appointment (partner side) and notifies the owner if it was active. */
export async function deleteAppointment(ctx: { partnerId: string }, id: string) {
  const a = await prisma.appointment.findFirst({ where: { id, partnerId: ctx.partnerId }, include: { client: { select: { userId: true } }, partner: { select: { tradeName: true } } } });
  if (!a) throw Errors.notFound("Agendamento não encontrado");
  if (a.status === "COMPLETED") throw Errors.badRequest("Atendimento concluído não pode ser excluído");
  await prisma.appointment.delete({ where: { id } });
  await recomputeDayLegs(ctx.partnerId, a.membershipId, localDateStr(a.startsAt));
  const ownerId = ownerUserIdOf(a);
  if (ownerId && (a.status === "CONFIRMED" || a.status === "REQUESTED")) {
    await notify({ userId: ownerId, type: "appointment.canceled", title: "Agendamento removido", body: `${a.partner.tradeName} removeu o atendimento de ${formatLocal(a.startsAt)}.`, data: { appointmentId: id }, email: true });
  }
}

// ───────── owner side ─────────

/** Appointments visible to an owner (read-only listing): their pets (own or shared, any level), their linked clients, or requested by them. */
export function ownerAppointmentWhere(userId: string): Prisma.AppointmentWhereInput {
  return {
    OR: [
      { client: { userId } },
      { requestedByUserId: userId },
      { pets: { some: { pet: { OR: [{ ownerId: userId }, { accesses: { some: { userId } } }] } } } },
    ],
  };
}

/**
 * Appointments an owner may ACT on (cancel / reschedule): visible to them AND every pet on it is owned by the user
 * (shared accounts are read-only).
 */
export function ownerActionAppointmentWhere(userId: string): Prisma.AppointmentWhereInput {
  return { AND: [ownerAppointmentWhere(userId), { pets: { every: { pet: { OR: editablePetOr(userId) } } } }] };
}

export const ownerAppointmentInclude = {
  ...appointmentInclude,
  partner: { select: { id: true, tradeName: true, slug: true, logoUrl: true, cancellationHours: true, addresses: { orderBy: { isPrimary: "desc" as const }, take: 1 } } },
} satisfies Prisma.AppointmentInclude;

export type OwnerAppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof ownerAppointmentInclude }>;

export function decorateOwnerAppointment(a: OwnerAppointmentRow) {
  // the partner's CRM phones are not exposed on the owner side
  const base = decorateAppointment({ ...a, client: a.client ? { ...a.client, phones: [] } : null });
  const venue = a.locationType === "PARTNER_VENUE" ? a.address ?? a.partner.addresses[0] ?? null : null;
  const c = coordsOf(venue);
  const { addresses: _addresses, ...partner } = a.partner;
  return {
    ...base,
    partner: { ...partner, address: a.partner.addresses[0] ?? null },
    links: venue ? mapsLinks(c?.lat, c?.lng, addressText(venue)) : a.locationType === "CLIENT_HOME" ? null : base.links,
  };
}

export async function listOwnerAppointments(userId: string, from: Date, to: Date) {
  const rows = await prisma.appointment.findMany({ where: { ...ownerAppointmentWhere(userId), startsAt: { lt: to }, endsAt: { gt: from } }, include: ownerAppointmentInclude, orderBy: { startsAt: "asc" } });
  const petIds = Array.from(new Set(rows.flatMap((r) => r.pets.map((p) => p.pet.id))));
  const owned = new Set(petIds.length ? (await prisma.pet.findMany({ where: { id: { in: petIds }, ownerId: userId }, select: { id: true } })).map((p) => p.id) : []);
  // canManage: every pet on it is owned by the user (shared accounts only view; cancel/reschedule → 403)
  return rows.map((r) => ({ ...decorateOwnerAppointment(r), canManage: r.pets.every((p) => owned.has(p.pet.id)) }));
}

async function ownerAppointmentOrThrow(userId: string, id: string) {
  const a = await prisma.appointment.findFirst({ where: { id, ...ownerActionAppointmentWhere(userId) }, include: ownerAppointmentInclude });
  if (!a) {
    const visible = await prisma.appointment.findFirst({ where: { id, ...ownerAppointmentWhere(userId) }, select: { id: true } });
    if (visible) throw Errors.forbidden("Você só pode visualizar este agendamento");
    throw Errors.notFound("Agendamento não encontrado");
  }
  return a;
}

function assertCancellationWindow(a: { startsAt: Date; status: AppointmentStatus; partner: { cancellationHours: number } }) {
  if (a.status !== "REQUESTED" && a.status !== "CONFIRMED") throw Errors.badRequest("Este agendamento não pode mais ser alterado");
  if (a.status === "CONFIRMED") {
    const hoursLeft = (a.startsAt.getTime() - Date.now()) / 3_600_000;
    if (hoursLeft < a.partner.cancellationHours) throw Errors.badRequest(`Cancelamentos e remarcações só até ${a.partner.cancellationHours} h antes do horário`);
  }
}

export async function ownerCancelAppointment(user: { id: string; name: string }, id: string, reason: string) {
  const a = await ownerAppointmentOrThrow(user.id, id);
  assertCancellationWindow(a);
  await prisma.appointment.update({ where: { id }, data: { status: "CANCELED", cancelReason: reason, canceledBy: "OWNER" } });
  await recomputeDayLegs(a.partnerId, a.membershipId, localDateStr(a.startsAt));
  await notifyPartner(a.partnerId, { type: "appointment.canceled", title: "Agendamento cancelado pelo tutor", body: `${user.name} cancelou o atendimento de ${formatLocal(a.startsAt)}. Motivo: ${reason}`, data: { appointmentId: id }, email: true });
  const row = await prisma.appointment.findUniqueOrThrow({ where: { id }, include: ownerAppointmentInclude });
  return decorateOwnerAppointment(row);
}

/** Creates a REQUESTED proposal linked to the original via `rescheduleOfId` (server-side). */
export async function ownerRescheduleAppointment(user: { id: string; name: string }, id: string, startsAt: string) {
  await rateLimit(`reschedule:${user.id}`, 20, 60 * 60 * 1000);
  const a = await ownerAppointmentOrThrow(user.id, id);
  assertCancellationWindow(a);
  const created = await createAppointments(
    { partnerId: a.partnerId, userId: user.id, byPartner: false },
    {
      clientId: a.clientId,
      petIds: a.pets.map((p) => p.pet.id),
      itemId: a.itemId,
      membershipId: a.membershipId,
      title: a.title,
      startsAt,
      durationMinutes: a.durationMinutes,
      locationType: a.locationType,
      addressId: a.addressId,
      locationNotes: a.locationNotes,
      notes: a.notes,
      rescheduleOfId: a.id,
      recurrence: "NONE",
      contractId: a.contractId,
      status: "REQUESTED",
      requestedByUserId: user.id,
    },
  );
  const proposal = created[0]!;
  await notifyPartner(a.partnerId, {
    type: "appointment.reschedule",
    title: "Pedido de remarcação",
    body: `${user.name} pediu para mover o atendimento de ${formatLocal(a.startsAt)} para ${formatLocal(proposal.startsAt)}. Confirme o novo horário na agenda.`,
    data: { appointmentId: proposal.id, originalAppointmentId: a.id },
    email: true,
  });
  return proposal;
}

/** Resolves (or creates) the partner's Client record for an owner making a booking and links the pets. */
export async function resolveOwnerClient(partnerId: string, user: { id: string; name: string }, petIds: string[]) {
  const editable = await prisma.pet.count({ where: { id: { in: petIds }, deletedAt: null, OR: editablePetOr(user.id) } });
  if (editable !== new Set(petIds).size) throw Errors.forbidden("Escolha apenas pets seus");
  let client = await prisma.client.findFirst({ where: { partnerId, userId: user.id, deletedAt: null } });
  if (!client) client = await prisma.client.create({ data: { partnerId, userId: user.id, name: user.name, source: "booking" } });
  const existing = await prisma.clientPet.findMany({ where: { clientId: client.id, petId: { in: petIds } }, select: { petId: true } });
  const have = new Set(existing.map((e) => e.petId));
  const missing = petIds.filter((p) => !have.has(p));
  if (missing.length) await prisma.clientPet.createMany({ data: missing.map((petId) => ({ clientId: client!.id, petId })), skipDuplicates: true });
  return client;
}
