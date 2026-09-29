import { catalogItemSchema, paginationQuery, ItemStatusEnum, ItemTypeEnum } from "@tinypet/shared";
import { z } from "zod";
import { handler, ok, parseBody, parseQuery, requirePartner, serialize } from "@/server";
import { listCatalog, createCatalogItem } from "@/server/catalog";

const listQuery = paginationQuery.extend({ status: ItemStatusEnum.optional(), type: ItemTypeEnum.optional(), q: z.string().max(200).optional() });

export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  const q = parseQuery(req, listQuery);
  const { items, total } = await listCatalog(ctx.partnerId, q);
  return ok(serialize(items), { meta: { page: q.page, pageSize: q.pageSize, total } });
});

export const POST = handler(async (req) => {
  const ctx = await requirePartner(req);
  const input = await parseBody(req, catalogItemSchema);
  return ok(serialize(await createCatalogItem(ctx.partnerId, input)), { status: 201 });
});
