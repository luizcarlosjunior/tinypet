import { z } from "zod";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { NextRequest } from "next/server";
import { prisma, type Prisma } from "@tinypet/db";
import { MEDIA_MAX_BYTES, bytesMatchMime } from "@tinypet/shared";
import { ApiError, Errors } from "../errors";
import { paginate } from "../api";
import { MAX_INPUT_PIXELS, payloadTooLarge, storeBytes } from "../media";

/** Accepted blog image types — no SVG. */
export const BLOG_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type BlogMime = (typeof BLOG_IMAGE_MIME)[number];
const EXT: Record<BlogMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
/** Multipart overhead allowed on top of the 10 MB file (boundaries, other fields). */
const MULTIPART_OVERHEAD = 64 * 1024;

export const mediaListSchema = z.object({
  q: z.string().trim().max(200).optional(),
  type: z.string().trim().max(40).optional(),
  inUse: z.enum(["0", "1"]).optional(),
  trash: z.enum(["0", "1"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
export const mediaPatchSchema = z.object({ alt: z.string().trim().max(300).nullable() });

const mediaSelect = { id: true, url: true, width: true, height: true, size: true, mimeType: true, originalFilename: true, alt: true, createdAt: true, deletedAt: true, metadata: true } satisfies Prisma.BlogMediaSelect;

/** Rejects early by Content-Length, then reads the multipart form and returns the `file` part as bytes. */
async function readMultipartImage(req: NextRequest): Promise<{ form: FormData; bytes: Buffer; mime: BlogMime; name: string }> {
  const declared = req.headers.get("content-length");
  if (declared != null) {
    const n = Number(declared);
    if (!Number.isFinite(n) || n < 0) throw Errors.badRequest("Content-Length inválido");
    if (n > MEDIA_MAX_BYTES + MULTIPART_OVERHEAD) throw payloadTooLarge();
  }
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("multipart/form-data")) throw Errors.badRequest("Envie o arquivo como multipart/form-data (campo file)");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw Errors.badRequest("Formulário inválido");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw Errors.badRequest("Arquivo ausente (campo file)");
  if (file.size > MEDIA_MAX_BYTES) throw payloadTooLarge();
  if (file.size < 16) throw Errors.badRequest("Arquivo vazio ou inválido");
  const mime = file.type as BlogMime;
  if (!(BLOG_IMAGE_MIME as readonly string[]).includes(mime)) throw Errors.badRequest("Formato não aceito. Use JPEG, PNG, WebP ou GIF.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytesMatchMime(bytes, mime)) throw Errors.badRequest("O conteúdo do arquivo não corresponde ao tipo informado");
  return { form, bytes, mime, name: (file as File).name || "imagem" };
}

async function imageMeta(bytes: Buffer, mime: BlogMime) {
  try {
    const m = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, animated: mime === "image/gif" }).metadata();
    const height = m.pageHeight && m.pages && m.pages > 1 ? m.pageHeight : m.height;
    return { width: m.width ?? null, height: height ?? null, format: m.format ?? null, pages: m.pages ?? 1 };
  } catch {
    throw Errors.badRequest("Imagem inválida, corrompida ou grande demais");
  }
}

function qualityOf(v: FormDataEntryValue | null): number {
  const n = typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 85;
}

function cleanFilename(name: string, ext: string) {
  const base = name.replace(/\.[^/.]+$/, "").replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 200) || "imagem";
  return `${base}.${ext}`;
}

/** POST /admin/blog/media — optional server optimization (webp/png via sharp), stored at blog/images/<uuid>.<ext>. */
export async function uploadBlogMedia(req: NextRequest, userId: string) {
  const { form, bytes, mime, name } = await readMultipartImage(req);
  const meta = await imageMeta(bytes, mime);
  const optimize = form.get("optimize") === "true" || form.get("optimize") === "1";
  const format = form.get("format");
  const quality = qualityOf(form.get("quality"));
  const altRaw = form.get("alt");
  const alt = typeof altRaw === "string" && altRaw.trim() ? altRaw.trim().slice(0, 300) : null;

  let out = bytes;
  let outMime: BlogMime = mime;
  let optimized = false;
  if (optimize && (format === "webp" || format === "png")) {
    try {
      const img = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, animated: mime === "image/gif" }).rotate();
      const buf = format === "png" ? await img.png({ quality, compressionLevel: 9, effort: 8, palette: true }).toBuffer() : await img.webp({ quality }).toBuffer();
      out = Buffer.from(buf);
      outMime = format === "png" ? "image/png" : "image/webp";
      optimized = true;
    } catch (e) {
      console.warn("[blog-media] optimization failed; storing original", e);
    }
  }
  const finalMeta = optimized ? await imageMeta(out, outMime) : meta;
  const ext = EXT[outMime];
  const key = `blog/images/${randomUUID()}.${ext}`;
  const url = await storeBytes(key, out, outMime);
  const created = await prisma.blogMedia.create({
    data: {
      url,
      s3Key: key,
      originalFilename: cleanFilename(name, ext),
      mimeType: outMime,
      size: out.byteLength,
      width: finalMeta.width,
      height: finalMeta.height,
      alt,
      userId,
      metadata: { analyzedAt: new Date().toISOString(), originalSize: bytes.byteLength, originalFormat: meta.format, originalMime: mime, isOptimized: optimized, ...(optimized ? { quality, format: String(format) } : {}), pages: finalMeta.pages },
    },
    select: mediaSelect,
  });
  return toMediaItem(created);
}

/** POST /admin/blog/media/estimate — re-encodes (without saving) to optimized PNG and WebP and returns the sizes. */
export async function estimateBlogMedia(req: NextRequest) {
  const { form, bytes, mime } = await readMultipartImage(req);
  const meta = await imageMeta(bytes, mime);
  const quality = qualityOf(form.get("quality"));
  const input = () => sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, animated: mime === "image/gif" }).rotate();
  try {
    const [png, webp] = await Promise.all([input().png({ quality, compressionLevel: 9, effort: 8, palette: true }).toBuffer(), input().webp({ quality }).toBuffer()]);
    return { pngSize: png.byteLength, webpSize: webp.byteLength, width: meta.width, height: meta.height, originalSize: bytes.byteLength };
  } catch {
    throw new ApiError(422, "UNPROCESSABLE", "Não foi possível processar a imagem");
  }
}

type MediaRow = Prisma.BlogMediaGetPayload<{ select: typeof mediaSelect }>;
function toMediaItem(m: MediaRow, inUse?: boolean) {
  return { ...m, ...(inUse !== undefined ? { inUse } : {}) };
}

/** Every media URL referenced by non-deleted posts (covers + URLs inside content). */
export async function usedMediaUrls(): Promise<Set<string>> {
  const posts = await prisma.blogPost.findMany({ where: { deletedAt: null }, select: { coverImageRect: true, coverImageSquare: true, coverOgImage: true, content: true } });
  const urls = new Set<string>();
  const re = /https?:\/\/[^\s"'<>)]+/g;
  for (const p of posts) {
    for (const u of [p.coverImageRect, p.coverImageSquare, p.coverOgImage]) if (u) urls.add(u);
    for (const m of p.content.matchAll(re)) urls.add(m[0].replace(/&amp;/g, "&"));
  }
  return urls;
}

export async function listBlogMedia(q: z.infer<typeof mediaListSchema>) {
  const where: Prisma.BlogMediaWhereInput = { deletedAt: q.trash === "1" ? { not: null } : null };
  if (q.q) where.OR = [{ originalFilename: { contains: q.q } }, { alt: { contains: q.q } }];
  if (q.type) where.mimeType = q.type.includes("/") ? q.type : `image/${q.type === "jpg" ? "jpeg" : q.type}`;
  const used = await usedMediaUrls();
  if (q.inUse === "1") where.url = { in: Array.from(used) };
  else if (q.inUse === "0" && used.size) where.url = { notIn: Array.from(used) };
  const [total, rows] = await Promise.all([
    prisma.blogMedia.count({ where }),
    prisma.blogMedia.findMany({ where, select: mediaSelect, orderBy: { createdAt: "desc" }, ...paginate(q.page, q.pageSize) }),
  ]);
  return { items: rows.map((m) => toMediaItem(m, used.has(m.url))), meta: { page: q.page, pageSize: q.pageSize, total } };
}

export type MediaUsage = { postId: string; title: string; slug: string; status: string; field: "content" | "coverImageRect" | "coverImageSquare" | "coverOgImage" };

export async function mediaUsageByUrl(url: string, s3Key?: string): Promise<MediaUsage[]> {
  const posts = await prisma.blogPost.findMany({
    where: {
      deletedAt: null,
      OR: [{ coverImageRect: url }, { coverImageSquare: url }, { coverOgImage: url }, { content: { contains: url } }, ...(s3Key ? [{ content: { contains: s3Key } }] : [])],
    },
    select: { id: true, title: true, slug: true, status: true, coverImageRect: true, coverImageSquare: true, coverOgImage: true, content: true },
  });
  const out: MediaUsage[] = [];
  for (const p of posts) {
    const base = { postId: p.id, title: p.title, slug: p.slug, status: p.status };
    if (p.coverImageRect === url) out.push({ ...base, field: "coverImageRect" });
    if (p.coverImageSquare === url) out.push({ ...base, field: "coverImageSquare" });
    if (p.coverOgImage === url) out.push({ ...base, field: "coverOgImage" });
    if (p.content.includes(url) || (s3Key && p.content.includes(s3Key))) out.push({ ...base, field: "content" });
  }
  return out;
}

async function loadMedia(id: string) {
  const m = await prisma.blogMedia.findUnique({ where: { id }, select: mediaSelect });
  if (!m) throw Errors.notFound("Mídia não encontrada");
  return m;
}

export async function getMediaUsage(id: string) {
  const m = await prisma.blogMedia.findUnique({ where: { id }, select: { url: true, s3Key: true } });
  if (!m) throw Errors.notFound("Mídia não encontrada");
  return mediaUsageByUrl(m.url, m.s3Key);
}

export async function updateMediaAlt(id: string, alt: string | null) {
  await loadMedia(id);
  return toMediaItem(await prisma.blogMedia.update({ where: { id }, data: { alt: alt || null }, select: mediaSelect }));
}

/** Soft delete (moves to the trash). 409 with the usage list when in use, unless `force`. */
export async function softDeleteMedia(id: string, force: boolean) {
  const m = await prisma.blogMedia.findUnique({ where: { id }, select: { id: true, url: true, s3Key: true, deletedAt: true } });
  if (!m) throw Errors.notFound("Mídia não encontrada");
  if (m.deletedAt) return { id, deleted: true };
  if (!force) {
    const usage = await mediaUsageByUrl(m.url, m.s3Key);
    if (usage.length) throw new ApiError(409, "CONFLICT", "Mídia em uso em posts. Use force=1 para excluir mesmo assim.", { usage });
  }
  await prisma.blogMedia.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id, deleted: true };
}

export async function restoreMedia(id: string) {
  await loadMedia(id);
  return toMediaItem(await prisma.blogMedia.update({ where: { id }, data: { deletedAt: null }, select: mediaSelect }));
}
