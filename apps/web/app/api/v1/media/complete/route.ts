import { prisma } from "@tinypet/db";
import { uploadCompleteSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, finalizeAsset, Errors } from "@/server";

/** Step 2 of upload: processes the file (crop, resize, WebP, thumb, EXIF strip) and returns final URLs. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const { assetId, crop } = await parseBody(req, uploadCompleteSchema);
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.notFound();
  if (asset.userId && asset.userId !== user.id) throw Errors.forbidden();
  if (asset.partnerId) {
    const m = await prisma.membership.findFirst({ where: { userId: user.id, partnerId: asset.partnerId } });
    if (!m) throw Errors.forbidden();
  }
  const done = await finalizeAsset(assetId, crop);
  return ok({ id: done.id, url: done.url, thumbUrl: done.thumbUrl, kind: done.kind, width: done.width, height: done.height, sizeBytes: done.sizeBytes });
});
