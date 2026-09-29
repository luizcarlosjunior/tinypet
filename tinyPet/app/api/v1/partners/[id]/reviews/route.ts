import { paginationQuery } from "@tinypet/shared";
import { handler, ok, parseQuery, requirePartner, serialize } from "@/server";
import { listPartnerReviews } from "@/server/ratings";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  const { page, pageSize } = parseQuery(req, paginationQuery);
  const { items, total } = await listPartnerReviews(ctx.partnerId, page, pageSize);
  return ok(serialize(items), { meta: { page, pageSize, total } });
});
