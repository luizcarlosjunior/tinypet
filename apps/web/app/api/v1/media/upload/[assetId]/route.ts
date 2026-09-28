import { prisma } from "@tinypet/db";
import { handler, ok, requireUser, storeBytes, Errors } from "@/server";

/** Local-dev upload sink (R2 presigned PUT replaces this in production). */
export const PUT = handler<{ assetId: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.assetId } });
  if (!asset) throw Errors.notFound();
  if (asset.userId && asset.userId !== user.id) throw Errors.forbidden();
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw Errors.badRequest("Arquivo acima de 10 MB");
  await storeBytes(asset.key, bytes, asset.mimeType);
  await prisma.mediaAsset.update({ where: { id: asset.id }, data: { sizeBytes: bytes.length } });
  return ok({ stored: true });
});
