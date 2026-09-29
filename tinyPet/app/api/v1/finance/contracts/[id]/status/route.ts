import { contractStatusSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize, clientIp } from "@/server";
import { setContractStatus } from "@/server/finance";

/** POST /finance/contracts/:id/status (contractStatusSchema). ACTIVE checks the active_contracts limit; CANCELED cancels open installments and future sessions. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const body = await parseBody(req, contractStatusSchema);
  return ok(serialize(await setContractStatus({ partnerId: ctx.partnerId, userId: ctx.user.id, membershipId: ctx.membershipId, ip: clientIp(req) }, params.id, body.status)));
});
