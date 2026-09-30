import { updateCatalogItemSchema } from "@tinypet/shared";
import { prisma } from "@/db";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { getCatalogItem, updateCatalogItem, softDeleteCatalogItem } from "@/server/catalog";
import { recomputePartnerRating } from "@/server/ratings";
import { assertOwnMediaUrls } from "@/server/media";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  return ok(serialize(await getCatalogItem(ctx.partnerId, params.id)));
});

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const input = await parseBody(req, updateCatalogItemSchema);
  if (input.media?.length) {
  const current = await prisma.catalogItemMedia.findMany({ where: { itemId: params.id, item: { partnerId: ctx.partnerId } }, select: { url: true, thumbUrl: true } });
    await assertOwnMediaUrls(input.media.flatMap((m) => [m.url, m.thumbUrl]), ctx.user.id, current.flatMap((m) => [m.url, m.thumbUrl]));
  }
  return ok(serialize(await updateCatalogItem(ctx.partnerId, params.id, input)));
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  await softDeleteCatalogItem(ctx.partnerId, params.id);
  await recomputePartnerRating(ctx.partnerId);
  return ok({ deleted: true });
});
