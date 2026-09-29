import { updateCatalogItemSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { getCatalogItem, updateCatalogItem, softDeleteCatalogItem } from "@/server/catalog";
import { recomputePartnerRating } from "@/server/ratings";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  return ok(serialize(await getCatalogItem(ctx.partnerId, params.id)));
});

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const input = await parseBody(req, updateCatalogItemSchema);
  return ok(serialize(await updateCatalogItem(ctx.partnerId, params.id, input)));
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  await softDeleteCatalogItem(ctx.partnerId, params.id);
  await recomputePartnerRating(ctx.partnerId);
  return ok({ deleted: true });
});
