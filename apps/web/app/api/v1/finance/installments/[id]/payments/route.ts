import { paymentSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize, clientIp } from "@/server";
import { addPayment } from "@/server/finance";

/** POST /finance/installments/:id/payments (paymentSchema) → partial allowed; PAID when paidAmount ≥ amount; audit `payment.create`. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const body = await parseBody(req, paymentSchema);
  return ok(serialize(await addPayment({ partnerId: ctx.partnerId, userId: ctx.user.id, membershipId: ctx.membershipId, ip: clientIp(req) }, params.id, body)), { status: 201 });
});
