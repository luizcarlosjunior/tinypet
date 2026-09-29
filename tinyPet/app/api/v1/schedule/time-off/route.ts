import { z } from "zod";
import { prisma } from "@/db";
import { timeOffSchema, id } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, requirePartner, Errors } from "@/server";

const query = z.object({ membershipId: id.optional(), from: z.string().max(40).optional(), to: z.string().max(40).optional() });

/** GET /schedule/time-off?membershipId&from&to */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  const q = parseQuery(req, query);
  const rows = await prisma.timeOff.findMany({
    where: {
      membership: { partnerId: ctx.partnerId, ...(q.membershipId ? { id: q.membershipId } : {}) },
      ...(q.from ? { endsAt: { gte: new Date(q.from) } } : {}),
      ...(q.to ? { startsAt: { lte: new Date(q.to) } } : {}),
    },
    include: { membership: { select: { id: true, user: { select: { name: true } } } } },
    orderBy: { startsAt: "asc" },
  });
  return ok(rows);
});

/** POST /schedule/time-off (timeOffSchema + membershipId?) → block for the caller (or another member, OWNER only). */
export const POST = handler(async (req) => {
  const ctx = await requirePartner(req);
  const body = await parseBody(req, timeOffSchema.extend({ membershipId: id.optional() }));
  const membershipId = body.membershipId ?? ctx.membershipId;
  if (membershipId !== ctx.membershipId && ctx.role !== "OWNER") throw Errors.forbidden("Apenas o dono bloqueia a agenda de outros profissionais");
  const m = await prisma.membership.findFirst({ where: { id: membershipId, partnerId: ctx.partnerId }, select: { id: true } });
  if (!m) throw Errors.notFound("Profissional não encontrado");
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (endsAt <= startsAt) throw Errors.badRequest("Fim deve ser depois do início");
  const row = await prisma.timeOff.create({ data: { membershipId, startsAt, endsAt, reason: body.reason ?? null } });
  return ok(row, { status: 201 });
});
