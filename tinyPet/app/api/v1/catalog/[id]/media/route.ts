import { z } from "zod";
import { catalogItemSchema } from "@tinypet/shared";
import { prisma } from "@/db";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { replaceCatalogMedia } from "@/server/catalog";
import { assertOwnMediaUrls } from "@/server/media";

const mediaSchema = z.object({ media: catalogItemSchema.shape.media.unwrap() });

/** Replaces the whole media list of the item. */
export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const { media } = await parseBody(req, mediaSchema);
  const current = await prisma.catalogItemMedia.findMany({ where: { itemId: params.id, item: { partnerId: ctx.partnerId } }, select: { url: true, thumbUrl: true } });
  await assertOwnMediaUrls(media.flatMap((m) => [m.url, m.thumbUrl]), ctx.user.id, current.flatMap((m) => [m.url, m.thumbUrl]));
  return ok(serialize(await replaceCatalogMedia(ctx.partnerId, params.id, media)));
});
