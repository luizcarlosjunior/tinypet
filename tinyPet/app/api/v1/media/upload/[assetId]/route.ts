import { prisma } from "@/db";
import { bytesMatchMime } from "@tinypet/shared";
import { handler, ok, requireUser, storeBytes, readBodyCapped, canAccessAsset, Errors } from "@/server";

/**
 * Local-dev upload sink (development only; in production uploads go straight to AWS S3 via presigned PUT).
 * Same ownership rules as /media/complete; only accepts while the asset is PENDING.
 * Body is read with a hard 10 MB cap and its magic bytes must match the declared MIME type.
 */
export const PUT = handler<{ assetId: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.assetId } });
  if (!asset) throw Errors.notFound();
  if (!(await canAccessAsset(asset, user.id))) throw Errors.forbidden();
  if (asset.status !== "PENDING") throw Errors.conflict("Esta mídia já foi enviada");
  const bytes = await readBodyCapped(req);
  if (!bytes.length) throw Errors.badRequest("Arquivo vazio");
  if (!bytesMatchMime(bytes.subarray(0, 4096), asset.mimeType)) throw Errors.badRequest("O conteúdo do arquivo não corresponde ao formato informado");
  await storeBytes(asset.key, bytes, asset.mimeType);
  await prisma.mediaAsset.update({ where: { id: asset.id }, data: { sizeBytes: bytes.length } });
  return ok({ stored: true });
});
