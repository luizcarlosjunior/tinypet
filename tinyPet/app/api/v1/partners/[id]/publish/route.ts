import { handler, ok, requirePartner, audit, clientIp } from "@/server";
import { publishPartner } from "@/server/partners";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id, { ownerOnly: true });
  const result = await publishPartner(ctx.partnerId);
  await audit({ userId: ctx.user.id, partnerId: ctx.partnerId, action: "partner.publish", entity: "Partner", entityId: ctx.partnerId, data: result, ip: clientIp(req) });
  return ok(result);
});
