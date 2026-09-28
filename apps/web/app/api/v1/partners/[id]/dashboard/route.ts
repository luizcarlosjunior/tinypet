import { handler, ok, requirePartner, serialize } from "@/server";
import { partnerDashboard } from "@/server/partners";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  const data = await partnerDashboard(ctx.partnerId);
  // Staff without finance permission does not see money.
  if (!ctx.canSeeFinance) return ok(serialize({ ...data, receivable30d: null, overdue: [] }));
  return ok(serialize(data));
});
