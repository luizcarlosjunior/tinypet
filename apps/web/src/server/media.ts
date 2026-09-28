import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { prisma, type MediaPurpose, type MediaAsset } from "@tinypet/db";
import { IMAGE_MIME, VIDEO_MIME, MEDIA_MAX_BYTES, LOGO_MAX_PX, AVATAR_PX, GALLERY_MAX_PX, extensionForMime, bytesMatchMime } from "@tinypet/shared";
import { ApiError, Errors } from "./errors";
import { getLimits } from "./plans";

/** Max decoded pixels accepted by sharp (≈ 6300×6300). Guards against decompression bombs. */
export const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Storage: AWS S3. Uploads go straight from the device to S3 via presigned PUT; the API only registers and processes.
 * Env: S3_BUCKET, AWS_REGION (or S3_REGION), optional AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (otherwise the default
 * AWS credential chain / IAM role is used), optional S3_PUBLIC_URL (CloudFront or custom domain; defaults to the
 * bucket's virtual-hosted URL) and S3_ENDPOINT (only for S3-compatible local testing, e.g. LocalStack/MinIO).
 * Without S3 configured, files are stored in apps/web/public/uploads — allowed in development only.
 */
const S3_BUCKET = process.env.S3_BUCKET ?? "";
const S3_REGION = process.env.S3_REGION ?? process.env.AWS_REGION ?? "sa-east-1";
const useS3 = !!S3_BUCKET;
/** In production every media file must go to S3; local disk storage is a development-only fallback. */
function assertStorageConfigured() {
  if (!useS3 && process.env.NODE_ENV === "production") {
    throw new Error("S3_BUCKET não configurado: em produção todas as mídias devem ser enviadas ao AWS S3.");
  }
}
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const s3 = useS3
  ? new S3Client({
      region: S3_REGION,
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
        : {}),
    })
  : null;

function s3PublicBase() {
  if (process.env.S3_PUBLIC_URL) return process.env.S3_PUBLIC_URL.replace(/\/$/, "");
  if (process.env.S3_ENDPOINT) return `${process.env.S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}`;
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
}

export const PURPOSE_RULES: Record<MediaPurpose, { kinds: ("IMAGE" | "VIDEO")[]; maxPx?: number; square?: boolean }> = {
  PARTNER_LOGO: { kinds: ["IMAGE"], maxPx: LOGO_MAX_PX, square: true },
  USER_AVATAR: { kinds: ["IMAGE"], maxPx: AVATAR_PX, square: true },
  PET_AVATAR: { kinds: ["IMAGE"], maxPx: AVATAR_PX, square: true },
  VENUE_PHOTO: { kinds: ["IMAGE"], maxPx: GALLERY_MAX_PX },
  PET_GALLERY: { kinds: ["IMAGE", "VIDEO"], maxPx: GALLERY_MAX_PX },
  CATALOG: { kinds: ["IMAGE", "VIDEO"], maxPx: GALLERY_MAX_PX },
  COURSE: { kinds: ["IMAGE", "VIDEO"], maxPx: GALLERY_MAX_PX },
  ATTACHMENT: { kinds: ["IMAGE"], maxPx: GALLERY_MAX_PX },
  RECEIPT: { kinds: ["IMAGE"], maxPx: GALLERY_MAX_PX },
};

export function kindFor(mime: string): "IMAGE" | "VIDEO" | "DOCUMENT" | null {
  if ((IMAGE_MIME as readonly string[]).includes(mime)) return "IMAGE";
  if ((VIDEO_MIME as readonly string[]).includes(mime)) return "VIDEO";
  if (mime === "application/pdf") return "DOCUMENT";
  return null;
}

export function publicUrl(key: string) {
  if (useS3) return `${s3PublicBase()}/${key}`;
  return `${APP_URL}/uploads/${key}`;
}

/** Creates a pending MediaAsset and returns where the client should upload. */
export async function createUploadTarget(input: { purpose: MediaPurpose; mimeType: string; sizeBytes: number; fileName: string; userId?: string; partnerId?: string }) {
  assertStorageConfigured();
  const kind = kindFor(input.mimeType);
  if (!kind) throw Errors.badRequest("Formato não aceito");
  if (input.sizeBytes > MEDIA_MAX_BYTES) throw Errors.badRequest("Arquivo acima de 10 MB");
  const rules = PURPOSE_RULES[input.purpose];
  if (kind !== "DOCUMENT" && !rules.kinds.includes(kind)) throw Errors.badRequest("Tipo de arquivo não permitido para este uso");
  if (kind === "DOCUMENT" && input.purpose !== "ATTACHMENT" && input.purpose !== "RECEIPT") throw Errors.badRequest("PDF só é aceito como anexo");

  // Extension comes ONLY from the allowlisted MIME map — never from the client-provided fileName.
  const ext = extensionForMime(input.mimeType);
  if (!ext) throw Errors.badRequest("Formato não aceito");
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1) throw Errors.badRequest("Tamanho inválido");
  const key = `${input.purpose.toLowerCase()}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  const asset = await prisma.mediaAsset.create({
    data: { key, url: publicUrl(key), kind: kind === "DOCUMENT" ? "IMAGE" : kind, purpose: input.purpose, mimeType: input.mimeType, sizeBytes: input.sizeBytes, status: "PENDING", userId: input.userId, partnerId: input.partnerId },
  });

  if (useS3 && s3) {
    // Non-images (PDF, video) are stored as attachments so a browser never renders them inline from the bucket.
    const disposition = kind === "IMAGE" ? undefined : "attachment";
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: input.mimeType, ContentLength: input.sizeBytes, ...(disposition ? { ContentDisposition: disposition } : {}) }),
      {
        expiresIn: 600,
        // Content-Length (and Content-Disposition) are part of the signature: the PUT must carry exactly these values.
        signableHeaders: new Set(["content-type", "content-length", ...(disposition ? ["content-disposition"] : [])]),
      },
    );
    return { assetId: asset.id, uploadUrl, method: "PUT" as const, headers: { "Content-Type": input.mimeType, ...(disposition ? { "Content-Disposition": disposition } : {}) }, url: asset.url };
  }
  // Local dev: client PUTs to our own endpoint
  return { assetId: asset.id, uploadUrl: `${APP_URL}/api/v1/media/upload/${asset.id}`, method: "PUT" as const, headers: { "Content-Type": input.mimeType }, url: asset.url };
}

export async function storeBytes(key: string, bytes: Buffer, contentType: string) {
  assertStorageConfigured();
  if (useS3 && s3) {
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: bytes, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable", ...(contentType.startsWith("image/") ? {} : { ContentDisposition: "attachment" }) }));
  } else {
    const file = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
  }
  return publicUrl(key);
}

/** Reads a stored object, at most `maxBytes` (default 10 MB). */
export async function readBytes(key: string, maxBytes = MEDIA_MAX_BYTES): Promise<Buffer> {
  if (useS3 && s3) {
    const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key, Range: `bytes=0-${maxBytes - 1}` }));
    const buf = Buffer.from(await res.Body!.transformToByteArray());
    return buf.length > maxBytes ? buf.subarray(0, maxBytes) : buf;
  }
  const fh = await fs.open(path.join(LOCAL_DIR, key), "r");
  try {
    const { size } = await fh.stat();
    const len = Math.min(size, maxBytes);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, 0);
    return buf;
  } finally {
    await fh.close();
  }
}

/** Real size of a stored object in bytes, or null when it doesn't exist (HeadObject on S3, stat locally). */
export async function statBytes(key: string): Promise<number | null> {
  try {
    if (useS3 && s3) {
      const res = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      return res.ContentLength ?? null;
    }
    const st = await fs.stat(path.join(LOCAL_DIR, key));
    return st.isFile() ? st.size : null;
  } catch {
    return null;
  }
}

export const payloadTooLarge = () => new ApiError(413, "PAYLOAD_TOO_LARGE", "Arquivo acima de 10 MB");

/**
 * Reads a request body with a hard byte cap (checks Content-Length first, then counts streamed bytes).
 * Never buffers more than `maxBytes` + one chunk.
 */
export async function readBodyCapped(req: Request, maxBytes = MEDIA_MAX_BYTES): Promise<Buffer> {
  const declared = req.headers.get("content-length");
  if (declared != null) {
    const n = Number(declared);
    if (!Number.isFinite(n) || n < 0) throw Errors.badRequest("Content-Length inválido");
    if (n > maxBytes) throw payloadTooLarge();
  }
  if (!req.body) return Buffer.alloc(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw payloadTooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

/** Ownership rule shared by the upload sink and /media/complete. */
export async function canAccessAsset(asset: Pick<MediaAsset, "userId" | "partnerId">, userId: string): Promise<boolean> {
  if (asset.userId) return asset.userId === userId;
  if (asset.partnerId) {
    const m = await prisma.membership.findFirst({ where: { userId, partnerId: asset.partnerId } });
    return !!m;
  }
  return false;
}

/** Marks an asset REJECTED and removes its stored object. */
async function rejectAsset(asset: Pick<MediaAsset, "id" | "key">, message: string): Promise<never> {
  await deleteBytes(asset.key);
  await prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: "REJECTED", sizeBytes: 0 } }).catch(() => {});
  throw Errors.badRequest(message);
}

/** Storage quota check using the real byte count (excludes the asset itself and rejected assets). */
async function assertQuota(asset: Pick<MediaAsset, "id" | "userId" | "partnerId">, realSize: number) {
  const owner = asset.partnerId ? { audience: "PARTNER" as const, id: asset.partnerId, key: "storage_mb" } : asset.userId ? { audience: "OWNER" as const, id: asset.userId, key: "owner_storage_mb" } : null;
  if (!owner) return;
  const { limits, planKey } = await getLimits(owner.audience, owner.id);
  const cap = limits[owner.key];
  if (cap?.quantity == null) return;
  const where = owner.audience === "PARTNER" ? { partnerId: owner.id } : { userId: owner.id };
  const agg = await prisma.mediaAsset.aggregate({ where: { ...where, id: { not: asset.id }, status: { not: "REJECTED" } }, _sum: { sizeBytes: true } });
  const used = agg._sum.sizeBytes ?? 0;
  if (used + realSize > cap.quantity * 1024 * 1024) {
    throw Errors.planLimit({ featureKey: owner.key, current: Math.round(used / 1024 / 1024), limit: cap.quantity, planKey });
  }
}

export async function deleteBytes(key: string) {
  try {
    if (useS3 && s3) await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    else await fs.unlink(path.join(LOCAL_DIR, key));
  } catch {
    /* ignore */
  }
}

export type Crop = { x: number; y: number; width: number; height: number };

/**
 * Processes an uploaded image: strips EXIF/GPS, optional crop, resizes per purpose, converts to WebP, makes a thumbnail.
 * Marks the asset READY. Videos are only validated (aspect 16:9 / 9:16 by metadata from client) and marked READY.
 */
export async function finalizeAsset(assetId: string, crop?: Crop) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.notFound("Mídia não encontrada");
  if (asset.status === "READY") return asset;
  if (asset.status !== "PENDING") throw Errors.conflict("Esta mídia não pode mais ser finalizada");
  const rules = PURPOSE_RULES[asset.purpose];

  // Real size of what was actually stored (never trust the declared sizeBytes).
  const realSize = await statBytes(asset.key);
  if (realSize == null || realSize === 0) throw Errors.badRequest("Arquivo ainda não foi enviado");
  if (realSize > MEDIA_MAX_BYTES) await rejectAsset(asset, "Arquivo acima de 10 MB");
  await assertQuota(asset, realSize);

  const input = await readBytes(asset.key, MEDIA_MAX_BYTES);
  // Magic bytes of the stored object must match the declared (allowlisted) MIME type — for every kind.
  if (!bytesMatchMime(input.subarray(0, 4096), asset.mimeType)) await rejectAsset(asset, "O conteúdo do arquivo não corresponde ao formato informado");

  if (asset.kind === "VIDEO" || asset.mimeType === "application/pdf") {
    return prisma.mediaAsset.update({ where: { id: assetId }, data: { status: "READY", sizeBytes: realSize } });
  }

  const sharpOpts = { failOn: "error" as const, limitInputPixels: MAX_INPUT_PIXELS };
  let meta: Metadata;
  try {
    meta = await sharp(input, sharpOpts).metadata();
  } catch {
    return rejectAsset(asset, "Imagem inválida ou corrompida");
  }
  if (!meta.width || !meta.height || meta.width * meta.height > MAX_INPUT_PIXELS || (meta.pages ?? 1) > 1) {
    await rejectAsset(asset, "Imagem com dimensões inválidas ou grande demais");
  }

  let webp: { data: Buffer; info: OutputInfo };
  let thumb: Buffer | null = null;
  try {
    let img = sharp(input, sharpOpts).rotate(); // rotate() applies EXIF orientation; output drops EXIF (incl. GPS)
    // Dimensions after EXIF rotation (orientation 5–8 swaps width/height)
    const swap = (meta.orientation ?? 1) >= 5;
    const W = swap ? meta.height! : meta.width!;
    const H = swap ? meta.width! : meta.height!;
    if (crop) {
      const left = Math.max(0, Math.round(crop.x));
      const top = Math.max(0, Math.round(crop.y));
      const width = Math.min(W - left, Math.round(crop.width));
      const height = Math.min(H - top, Math.round(crop.height));
      if (width > 0 && height > 0) img = sharp(await img.png({ compressionLevel: 1 }).toBuffer(), sharpOpts).extract({ left, top, width, height });
    }
    const maxPx = rules.maxPx ?? GALLERY_MAX_PX;
    if (rules.square) img = img.resize(maxPx, maxPx, { fit: "cover", position: "centre", withoutEnlargement: true });
    else img = img.resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true });
    webp = await img.webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    if (!rules.square) thumb = await sharp(webp.data).resize(400, 400, { fit: "inside" }).webp({ quality: 75 }).toBuffer();
  } catch {
    return rejectAsset(asset, "Não foi possível processar a imagem");
  }

  const newKey = asset.key.replace(/\.[^.]+$/, "") + ".webp";
  const url = await storeBytes(newKey, webp.data, "image/webp");
  if (newKey !== asset.key) await deleteBytes(asset.key);
  const thumbUrl = thumb ? await storeBytes(newKey.replace(/\.webp$/, ".thumb.webp"), thumb, "image/webp") : null;

  return prisma.mediaAsset.update({
    where: { id: assetId },
    data: { key: newKey, url, thumbUrl, mimeType: "image/webp", sizeBytes: webp.data.length + (thumb?.length ?? 0), width: webp.info.width, height: webp.info.height, status: "READY" },
  });
}

/** Storage used by an owner or partner, in bytes. */
export async function storageUsed(where: { userId?: string; partnerId?: string }) {
  const agg = await prisma.mediaAsset.aggregate({ where: { ...where, status: { not: "REJECTED" } }, _sum: { sizeBytes: true } });
  return agg._sum.sizeBytes ?? 0;
}
