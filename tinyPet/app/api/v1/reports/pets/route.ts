import { petReportQuery } from "@tinypet/shared";
import { handler, ok, parseQuery } from "@/server";
import { petReport, reportMode } from "@/server/reports";

/** Partner (X-Partner-Id): own book with tutor contact. Admin (no header): aggregated groups only, "menos de 5" masking. */
export const GET = handler(async (req) => {
  const mode = await reportMode(req);
  const q = parseQuery(req, petReportQuery);
  const r = await petReport(mode, q);
  return ok(r, { meta: { page: q.page, pageSize: q.pageSize, total: r.total } });
});
