import { handler, ok, requirePartner, serialize, clientIp } from "@/server";
import { deletePayment } from "@/server/finance";

/** DELETE /finance/payments/:pid → reverts the payment and recomputes the installment status. */
export const DELETE = handler<{ pid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  return ok(serialize(await deletePayment({ partnerId: ctx.partnerId, userId: ctx.user.id, membershipId: ctx.membershipId, ip: clientIp(req) }, params.pid)));
});
