import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma, type MediaPurpose } from "@tinypet/db";
import { IMAGE_MIME, VIDEO_MIME, MEDIA_MAX_BYTES, LOGO_MAX_PX, AVATAR_PX, GALLERY_MAX_PX } from "@tinypet/shared";
import { Errors } from "./errors";

const useR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const s3 = useR2
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    })
  : null;

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
  if (useR2) return `${process.env.R2_PUBLIC_URL?.replace(/\/$/, "")}/${key}`;
  return `${APP_URL}/uploads/${key}`;
}

/** Creates a pending MediaAsset and returns where the client should upload. */
export async function createUploadTarget(input: { purpose: MediaPurpose; mimeType: string; sizeBytes: number; fileName: string; userId?: string; partnerId?: string }) {
  const kind = kindFor(input.mimeType);
  if (!kind) throw Errors.badRequest("Formato não aceito");
  if (input.sizeBytes > MEDIA_MAX_BYTES) throw Errors.badRequest("Arquivo acima de 10 MB");
  const rules = PURPOSE_RULES[input.purpose];
  if (kind !== "DOCUMENT" && !rules.kinds.includes(kind)) throw Errors.badRequest("Tipo de arquivo não permitido para este uso");
  if (kind === "DOCUMENT" && input.purpose !== "ATTACHMENT" && input.purpose !== "RECEIPT") throw Errors.badRequest("PDF só é aceito como anexo");

  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `${input.purpose.toLowerCase()}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  const asset = await prisma.mediaAsset.create({
    data: { key, url: publicUrl(key), kind: kind === "DOCUMENT" ? "IMAGE" : kind, purpose: input.purpose, mimeType: input.mimeType, sizeBytes: input.sizeBytes, status: "PENDING", userId: input.userId, partnerId: input.partnerId },
  });

  if (useR2 && s3) {
    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, ContentType: input.mimeType }), { expiresIn: 600 });
    return { assetId: asset.id, uploadUrl, method: "PUT" as const, headers: { "Content-Type": input.mimeType }, url: asset.url };
  }
  // Local dev: client PUTs to our own endpoint
  return { assetId: asset.id, uploadUrl: `${APP_URL}/api/v1/media/upload/${asset.id}`, method: "PUT" as const, headers: { "Content-Type": input.mimeType }, url: asset.url };
}

export async function storeBytes(key: string, bytes: Buffer, contentType: string) {
  if (useR2 && s3) {
    await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, Body: bytes, ContentType: contentType }));
  } else {
    const file = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
  }
  return publicUrl(key);
}

export async function readBytes(key: string): Promise<Buffer> {
  if (useR2 && s3) {
    const res = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  return fs.readFile(path.join(LOCAL_DIR, key));
}

export async function deleteBytes(key: string) {
  try {
    if (useR2 && s3) await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
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
  const rules = PURPOSE_RULES[asset.purpose];

  if (asset.kind === "VIDEO" || asset.mimeType === "application/pdf") {
    return prisma.mediaAsset.update({ where: { id: assetId }, data: { status: "READY" } });
  }

  const input = await readBytes(asset.key);
  let img = sharp(input, { failOn: "none" }).rotate(); // rotate() applies EXIF orientation; output drops EXIF (incl. GPS)
  const meta = await img.metadata();
  if (crop && meta.width && meta.height) {
    const left = Math.max(0, Math.round(crop.x));
    const top = Math.max(0, Math.round(crop.y));
    const width = Math.min(meta.width - left, Math.round(crop.width));
    const height = Math.min(meta.height - top, Math.round(crop.height));
    if (width > 0 && height > 0) img = img.extract({ left, top, width, height });
  }
  const maxPx = rules.maxPx ?? GALLERY_MAX_PX;
  if (rules.square) img = img.resize(maxPx, maxPx, { fit: "cover", position: "centre", withoutEnlargement: true });
  else img = img.resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true });

  const webp = await img.webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
  const newKey = asset.key.replace(/\.[^.]+$/, "") + ".webp";
  const url = await storeBytes(newKey, webp.data, "image/webp");
  if (newKey !== asset.key) await deleteBytes(asset.key);

  let thumbUrl: string | null = null;
  if (!rules.square) {
    const thumb = await sharp(webp.data).resize(400, 400, { fit: "inside" }).webp({ quality: 75 }).toBuffer();
    thumbUrl = await storeBytes(newKey.replace(/\.webp$/, ".thumb.webp"), thumb, "image/webp");
  }

  return prisma.mediaAsset.update({
    where: { id: assetId },
    data: { key: newKey, url, thumbUrl, mimeType: "image/webp", sizeBytes: webp.data.length, width: webp.info.width, height: webp.info.height, status: "READY" },
  });
}

/** Storage used by an owner or partner, in bytes. */
export async function storageUsed(where: { userId?: string; partnerId?: string }) {
  const agg = await prisma.mediaAsset.aggregate({ where, _sum: { sizeBytes: true } });
  return agg._sum.sizeBytes ?? 0;
}
