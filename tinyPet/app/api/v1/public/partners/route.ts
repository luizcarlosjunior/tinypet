import { partnerSearchQuery } from "@tinypet/shared";
import { handler, ok, parseQuery } from "@/server";
import { searchPartners } from "@/server/public";

export const GET = handler(async (req) => {
  const q = parseQuery(req, partnerSearchQuery);
  const { items, total } = await searchPartners(q);
  return ok(items, { meta: { page: q.page, pageSize: q.pageSize, total }, cache: 60 });
});
