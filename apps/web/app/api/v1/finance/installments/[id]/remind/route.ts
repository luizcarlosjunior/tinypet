import { handler, ok, requirePartner, clientIp } from "@/server";
import { remindInstallment } from "@/server/finance";

/** POST /finance/installments/:id/remind → notifies the owner (in-app + e-mail) and sets reminderSentAt. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  return ok(await remindInstallment({ partnerId: ctx.partnerId, userId: ctx.user.id, membershipId: ctx.membershipId, ip: clientIp(req) }, params.id));
});
