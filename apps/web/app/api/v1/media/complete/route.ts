import { prisma } from "@tinypet/db";
import { uploadCompleteSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, finalizeAsset, canAccessAsset, Errors } from "@/server";

/** Step 2 of upload: validates magic bytes/size, processes the file (crop, resize, WebP, thumb, EXIF strip) and returns final URLs. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const { assetId, crop } = await parseBody(req, uploadCompleteSchema);
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.notFound();
  if (!(await canAccessAsset(asset, user.id))) throw Errors.forbidden();
  // Idempotent for the owner: an already-READY asset is returned as-is; anything else non-PENDING is refused.
  if (asset.status !== "PENDING" && asset.status !== "READY") throw Errors.conflict("Esta mídia não pode mais ser finalizada");
  const done = asset.status === "READY" ? asset : await finalizeAsset(assetId, crop);
  return ok({ id: done.id, url: done.url, thumbUrl: done.thumbUrl, kind: done.kind, width: done.width, height: done.height, sizeBytes: done.sizeBytes });
});
