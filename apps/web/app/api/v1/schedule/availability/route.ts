import { z } from "zod";
import { prisma } from "@tinypet/db";
import { availabilitySchema, id } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, requirePartner, Errors } from "@/server";

const query = z.object({ membershipId: id.optional() });

async function memberOf(ctx: { partnerId: string; membershipId: string; role: string }, membershipId?: string, write = false) {
  const target = membershipId ?? ctx.membershipId;
  if (write && target !== ctx.membershipId && ctx.role !== "OWNER") throw Errors.forbidden("Apenas o dono edita a disponibilidade de outros profissionais");
  const m = await prisma.membership.findFirst({ where: { id: target, partnerId: ctx.partnerId }, select: { id: true } });
  if (!m) throw Errors.notFound("Profissional não encontrado");
  return m.id;
}

/** GET /schedule/availability?membershipId= → weekly working windows of a professional (defaults to the caller). */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  const q = parseQuery(req, query);
  const membershipId = await memberOf(ctx, q.membershipId);
  const slots = await prisma.availability.findMany({ where: { membershipId }, orderBy: [{ weekday: "asc" }, { startsAt: "asc" }] });
  return ok({ membershipId, slots });
});

/** PUT /schedule/availability?membershipId= (availabilitySchema) → replaces all windows. */
export const PUT = handler(async (req) => {
  const ctx = await requirePartner(req);
  const q = parseQuery(req, query);
  const membershipId = await memberOf(ctx, q.membershipId, true);
  const body = await parseBody(req, availabilitySchema);
  for (const s of body.slots) if (s.endsAt <= s.startsAt) throw Errors.badRequest("Horário final deve ser depois do inicial");
  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { membershipId } }),
    prisma.availability.createMany({ data: body.slots.map((s) => ({ membershipId, weekday: s.weekday, startsAt: s.startsAt, endsAt: s.endsAt })) }),
  ]);
  const slots = await prisma.availability.findMany({ where: { membershipId }, orderBy: [{ weekday: "asc" }, { startsAt: "asc" }] });
  return ok({ membershipId, slots });
});
