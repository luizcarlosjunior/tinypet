import { handler, ok, requirePartner } from "@/server";
import { publishPartner } from "@/server/partners";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  return ok(await publishPartner(ctx.partnerId));
});
