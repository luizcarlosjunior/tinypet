import { prisma } from "@/db";
import { handler, ok, requirePartner, Errors } from "@/server";

/** DELETE /schedule/time-off/:id */
export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const row = await prisma.timeOff.findFirst({ where: { id: params.id, membership: { partnerId: ctx.partnerId } } });
  if (!row) throw Errors.notFound("Bloqueio não encontrado");
  if (row.membershipId !== ctx.membershipId && ctx.role !== "OWNER") throw Errors.forbidden();
  await prisma.timeOff.delete({ where: { id: row.id } });
  return ok({ deleted: true });
});
