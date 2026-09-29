import { prisma } from "@tinypet/db";
import { uploadCompleteSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, finalizeAsset, canAccessAsset, resolveVideoCover, Errors } from "@/server";

/**
 * Step 2 of upload: validates magic bytes/size and processes the file — images: crop, resize, WebP, thumb, EXIF strip;
 * videos: MP4/H.264/AAC, 1080p|720p 16:9|9:16, bitrate caps (VIDEO_OUTPUT). Optional `coverAssetId` (videos only):
 * a READY VIDEO_COVER image with the video's aspect; it becomes the video's `thumbUrl`.
 */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const { assetId, crop, coverAssetId } = await parseBody(req, uploadCompleteSchema);
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.notFound();
  if (!(await canAccessAsset(asset, user.id))) throw Errors.forbidden();
  // Idempotent for the owner: an already-READY asset is returned as-is; anything else non-PENDING is refused.
  if (asset.status !== "PENDING" && asset.status !== "READY") throw Errors.conflict("Esta mídia não pode mais ser finalizada");
  // Check the cover before finalizing so a bad cover doesn't leave a half-done upload (declared size = real size for videos).
  if (coverAssetId) await resolveVideoCover(asset, coverAssetId, user.id);
  let done = asset.status === "READY" ? asset : await finalizeAsset(assetId, crop);
  const durationSeconds = "durationSeconds" in done ? (done.durationSeconds ?? null) : null;
  if (coverAssetId) {
    const cover = await resolveVideoCover(done, coverAssetId, user.id);
    done = await prisma.mediaAsset.update({ where: { id: done.id }, data: { thumbUrl: cover.url } });
  }
  return ok({
    id: done.id,
    url: done.url,
    thumbUrl: done.thumbUrl,
    kind: done.kind,
    width: done.width,
    height: done.height,
    sizeBytes: done.sizeBytes,
    ...(done.kind === "VIDEO" ? { durationSeconds } : {}),
  });
});
