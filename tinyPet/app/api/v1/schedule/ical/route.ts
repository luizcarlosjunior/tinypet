import { z } from "zod";
import { prisma } from "@/db";
import { id } from "@tinypet/shared";
import { handler, ok, parseQuery, requirePartner, Errors } from "@/server";
import { calendarUrl, rotateCalendarToken } from "@/server/ical";

const query = z.object({ membershipId: id.optional() });

/** GET /schedule/ical?membershipId? → current subscription URL of the member (null when not generated yet). Other members: owner only. */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  const q = parseQuery(req, query);
  const membershipId = q.membershipId ?? ctx.membershipId;
  if (membershipId !== ctx.membershipId && ctx.role !== "OWNER") throw Errors.forbidden();
  const m = await prisma.membership.findFirst({ where: { id: membershipId, partnerId: ctx.partnerId }, select: { calendarToken: true } });
  if (!m) throw Errors.notFound("Profissional não encontrado");
  return ok({ url: m.calendarToken ? calendarUrl(m.calendarToken) : null });
});

/** POST /schedule/ical?membershipId? → generates/rotates the calendar token and returns the iCal URL. */
export const POST = handler(async (req) => {
  const ctx = await requirePartner(req);
  const q = parseQuery(req, query);
  const membershipId = q.membershipId ?? ctx.membershipId;
  if (membershipId !== ctx.membershipId && ctx.role !== "OWNER") throw Errors.forbidden();
  const m = await prisma.membership.findFirst({ where: { id: membershipId, partnerId: ctx.partnerId }, select: { id: true } });
  if (!m) throw Errors.notFound("Profissional não encontrado");
  return ok(await rotateCalendarToken(m.id));
});
