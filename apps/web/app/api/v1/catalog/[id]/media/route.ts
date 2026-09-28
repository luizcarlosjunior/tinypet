import { z } from "zod";
import { catalogItemSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { replaceCatalogMedia } from "@/server/catalog";

const mediaSchema = z.object({ media: catalogItemSchema.shape.media.unwrap() });

/** Replaces the whole media list of the item. */
export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const { media } = await parseBody(req, mediaSchema);
  return ok(serialize(await replaceCatalogMedia(ctx.partnerId, params.id, media)));
});
