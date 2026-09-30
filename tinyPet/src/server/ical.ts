import { randomBytes } from "node:crypto";
import { prisma } from "@/db";
import { addressText, dayBounds, localDateStr } from "./scheduling";
import { Errors } from "./errors";

/*
 * iCalendar feed per professional (Membership.calendarToken).
 * POST /schedule/ical rotates the token; GET /schedule/ical/:token (public) serves the VCALENDAR.
 */

export type IcsEvent = { uid: string; start: Date; end: Date; summary: string; description?: string | null; location?: string | null; url?: string | null; status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED" };

export function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

export function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** RFC 5545 line folding at 75 octets. */
export function foldLine(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    const limit = parts.length ? 74 : 75;
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  if (cur) parts.push(cur);
  return parts.join("\r\n ");
}

export function buildIcs(calendarName: string, events: IcsEvent[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//tinyPet//Agenda//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(calendarName)}`, "X-WR-TIMEZONE:America/Sao_Paulo"];
  const stamp = icsDate(new Date());
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@tinypet`, `DTSTAMP:${stamp}`, `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.end)}`, `SUMMARY:${icsEscape(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.status) lines.push(`STATUS:${e.status}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function generateCalendarToken() {
  return randomBytes(24).toString("base64url");
}

export function calendarUrl(token: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3033").replace(/\/$/, "");
  return `${base}/api/v1/schedule/ical/${token}`;
}

/** Generates (or rotates) the calendar token of a membership and returns the subscription URL. */
export async function rotateCalendarToken(membershipId: string) {
  const token = generateCalendarToken();
  await prisma.membership.update({ where: { id: membershipId }, data: { calendarToken: token } });
  return { calendarToken: token, url: calendarUrl(token) };
}

/** VCALENDAR with the membership's appointments from today on (non-canceled). Returns null for an unknown token. */
export async function icsForToken(token: string): Promise<string | null> {
  const m = await prisma.membership.findUnique({ where: { calendarToken: token }, include: { partner: { select: { tradeName: true, deletedAt: true } }, user: { select: { name: true, deletedAt: true } } } });
  // feed dies with the partner or the professional account
  if (m && (m.partner.deletedAt || m.user.deletedAt)) return null;
  if (!m) return null;
  const { start } = dayBounds(localDateStr(new Date()));
  const rows = await prisma.appointment.findMany({
    where: { membershipId: m.id, partnerId: m.partnerId, status: { not: "CANCELED" }, startsAt: { gte: start } },
    include: { client: { select: { name: true } }, item: { select: { name: true } }, pets: { include: { pet: { select: { name: true } } } }, address: true, travelLeg: true },
    orderBy: { startsAt: "asc" },
  });
  const events: IcsEvent[] = [];
  for (const a of rows) {
    const pets = a.pets.map((p) => p.pet.name).join(", ");
    const summary = [a.title ?? a.item?.name ?? "Atendimento", a.client?.name].filter(Boolean).join(" — ");
    const description = [pets ? `Pets: ${pets}` : null, a.notes, a.locationNotes, a.address?.accessNotes ? `Acesso: ${a.address.accessNotes}` : null].filter(Boolean).join("\n");
    events.push({ uid: a.id, start: a.startsAt, end: a.endsAt, summary, description, location: addressText(a.address) || null, status: a.status === "REQUESTED" ? "TENTATIVE" : "CONFIRMED" });
    if (a.travelLeg) {
      events.push({ uid: `${a.id}-travel`, start: a.travelLeg.startsAt, end: a.travelLeg.endsAt, summary: `Deslocamento (${Number(a.travelLeg.distanceKm)} km)`, description: `Até ${a.client?.name ?? "cliente"}${a.travelLeg.estimated ? " (estimativa)" : ""}` });
    }
  }
  return buildIcs(`${m.partner.tradeName} — ${m.user.name}`, events);
}

export function assertMembershipOfPartner(membershipId: string, partnerId: string) {
  return prisma.membership.findFirst({ where: { id: membershipId, partnerId } }).then((m) => {
    if (!m) throw Errors.notFound("Profissional não encontrado");
    return m;
  });
}
