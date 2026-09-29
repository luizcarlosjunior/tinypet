import { prisma } from "@/db";
import { handler, ok, requirePartner, audit, clientIp, Errors } from "@/server";

/** DELETE /finance/transactions/:id */
export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const row = await prisma.transaction.findFirst({ where: { id: params.id, partnerId: ctx.partnerId } });
  if (!row) throw Errors.notFound("Lançamento não encontrado");
  await prisma.transaction.delete({ where: { id: row.id } });
  await audit({ userId: ctx.user.id, partnerId: ctx.partnerId, action: "transaction.delete", entity: "Transaction", entityId: row.id, data: { kind: row.kind, amount: Number(row.amount) }, ip: clientIp(req) });
  return ok({ deleted: true });
});
