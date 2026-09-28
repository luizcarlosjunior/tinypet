import { financeReportQuery } from "@tinypet/shared";
import { handler, ok, parseQuery, requirePartner, serialize } from "@/server";
import { financeSummary } from "@/server/finance";

/** GET /finance/summary?from&to → { receivable, overdue[], receivedByMonth[], receivedByMethod[], receivedByService[], cashflow[] } */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const q = parseQuery(req, financeReportQuery);
  return ok(serialize(await financeSummary(ctx.partnerId, q)));
});
