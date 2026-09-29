import { handler, ok, requirePartner, partnerUsage } from "@/server";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  return ok(await partnerUsage(ctx.partnerId));
});
