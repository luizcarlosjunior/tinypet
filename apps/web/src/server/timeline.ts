import { prisma } from "@tinypet/db";
import { ymd } from "./pets";

export type TimelineItem = {
  id: string;
  source: "event" | "appointment" | "vaccination" | "measurement" | "badge";
  type: string;
  title: string;
  description: string | null;
  occurredAt: Date;
  partner: { id: string; tradeName: string } | null;
  user: { id: string; name: string } | null;
  attachments: unknown;
  data?: unknown;
};

/** Merges PetHistoryEvent, completed appointments, vaccinations, measurements and earned badges, newest first. */
export async function petTimeline(petId: string, limit = 100): Promise<TimelineItem[]> {
  const [events, appointments, vaccinations, measurements, badges] = await Promise.all([
    prisma.petHistoryEvent.findMany({
      where: { petId },
      include: { partner: { select: { id: true, tradeName: true } }, user: { select: { id: true, name: true } } },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: { status: "COMPLETED", pets: { some: { petId } } },
      include: { partner: { select: { id: true, tradeName: true } }, item: { select: { id: true, name: true } } },
      orderBy: { startsAt: "desc" },
    }),
    prisma.vaccination.findMany({ where: { petId }, include: { partner: { select: { id: true, tradeName: true } } }, orderBy: { appliedAt: "desc" } }),
    prisma.bodyMeasurement.findMany({
      where: { petId },
      include: { partner: { select: { id: true, tradeName: true } }, user: { select: { id: true, name: true } } },
      orderBy: { measuredAt: "desc" },
    }),
    prisma.earnedBadge.findMany({ where: { petId }, include: { badge: { include: { partner: { select: { id: true, tradeName: true } } } } } }),
  ]);

  const items: TimelineItem[] = [];
  const eventAppointmentIds = new Set(events.filter((e) => e.appointmentId).map((e) => e.appointmentId));
  const vaccineEventKeys = new Set(events.filter((e) => e.type === "VACCINE" || e.type === "DEWORMING").map((e) => `${e.type}|${e.title}|${ymd(e.occurredAt)}`));

  for (const e of events) {
    items.push({ id: `event:${e.id}`, source: "event", type: e.type, title: e.title, description: e.description, occurredAt: e.occurredAt, partner: e.partner, user: e.user, attachments: e.attachments, data: { appointmentId: e.appointmentId } });
  }
  for (const a of appointments) {
    if (eventAppointmentIds.has(a.id)) continue; // the COMPLETED status handler already wrote a VISIT event
    items.push({
      id: `appointment:${a.id}`,
      source: "appointment",
      type: "VISIT",
      title: a.item?.name ?? a.title ?? `Visita · ${a.partner.tradeName}`,
      description: a.report,
      occurredAt: a.startsAt,
      partner: a.partner,
      user: null,
      // reportPhotos is string[]; expose the same [{ url, name, type }] shape as history events
      attachments: Array.isArray(a.reportPhotos) ? (a.reportPhotos as unknown[]).filter((u): u is string => typeof u === "string").map((url, i) => ({ url, name: `Foto ${i + 1}`, type: "image" })) : null,
      data: { appointmentId: a.id, nextSteps: a.nextSteps },
    });
  }
  for (const v of vaccinations) {
    if (vaccineEventKeys.has(`${v.kind}|${v.name}|${ymd(v.appliedAt)}`)) continue; // creating a vaccination also writes an event
    items.push({
      id: `vaccination:${v.id}`,
      source: "vaccination",
      type: v.kind,
      title: v.name,
      description: v.notes,
      occurredAt: v.appliedAt,
      partner: v.partner,
      user: null,
      attachments: null,
      data: { vaccinationId: v.id, nextDueAt: v.nextDueAt ? ymd(v.nextDueAt) : null },
    });
  }
  for (const m of measurements) {
    items.push({
      id: `measurement:${m.id}`,
      source: "measurement",
      type: "WEIGHT",
      title: `Pesagem: ${(m.weightG / 1000).toFixed(2)} kg`,
      description: m.notes,
      occurredAt: m.measuredAt,
      partner: m.partner,
      user: m.user,
      attachments: null,
      data: { measurementId: m.id, weightG: m.weightG, vetVerified: m.vetVerified },
    });
  }
  for (const b of badges) {
    items.push({
      id: `badge:${b.id}`,
      source: "badge",
      type: "ACHIEVEMENT",
      title: b.badge.name,
      description: b.badge.description,
      occurredAt: b.earnedAt,
      partner: b.badge.partner,
      user: null,
      attachments: null,
      data: { badgeKey: b.badge.key, iconUrl: b.badge.iconUrl },
    });
  }
  items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return items.slice(0, limit);
}
