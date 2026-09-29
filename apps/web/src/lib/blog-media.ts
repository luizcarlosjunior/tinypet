/**
 * Blog image pipeline (browser): canvas processing (longest side ≤ 1920 px, WebP q85), crop rendering for covers,
 * XHR multipart upload with progress to `POST /api/v1/admin/blog/media` and size estimate via `/media/estimate`.
 * Mirrors the reference blog (`ImageUploadWithCrop` / `MediaUploadDialog`). Pure helpers are unit-tested.
 */
import { ApiClientError } from "./api-client";

export const MAX_IMAGE_SIDE = 1920;
export const DEFAULT_QUALITY = 85;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** No SVG (script vector) — same list the server accepts. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(",");

export type CropPresetKey = "rect" | "square" | "og" | "inline";
export type CropPreset = { key: CropPresetKey; label: string; aspect: number; width: number; height: number; format: "webp" | "png" };

export const CROP_PRESETS: Record<CropPresetKey, CropPreset> = {
  rect: { key: "rect", label: "Capa 16:9", aspect: 16 / 9, width: 1920, height: 1080, format: "webp" },
  square: { key: "square", label: "Capa quadrada 1:1", aspect: 1, width: 1080, height: 1080, format: "webp" },
  og: { key: "og", label: "Imagem de compartilhamento (OG)", aspect: 1200 / 630, width: 1200, height: 630, format: "png" },
  inline: { key: "inline", label: "Imagem no texto 16:9", aspect: 16 / 9, width: 1920, height: 1080, format: "webp" },
};

export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

/** Quality 1–100 (integer). Non-numbers fall back to the default (85). */
export function clampQuality(q: unknown, fallback = DEFAULT_QUALITY): number {
  const n = typeof q === "string" ? Number(q) : typeof q === "number" ? q : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.round(n)));
}

/** Scales (never upscales) so the longest side is ≤ `max`. */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE): Size {
  const w = Math.max(1, Math.round(width || 1));
  const h = Math.max(1, Math.round(height || 1));
  if (w <= max && h <= max) return { width: w, height: h };
  if (w >= h) return { width: max, height: Math.max(1, Math.round((h * max) / w)) };
  return { width: Math.max(1, Math.round((w * max) / h)), height: max };
}

/** Converts a crop measured on the rendered <img> into natural-pixel coordinates, clamped to the image bounds. */
export function toNaturalCrop(crop: Rect, displayed: Size, natural: Size): Rect {
  const sx = displayed.width > 0 ? natural.width / displayed.width : 1;
  const sy = displayed.height > 0 ? natural.height / displayed.height : 1;
  const x = Math.min(Math.max(0, crop.x * sx), natural.width);
  const y = Math.min(Math.max(0, crop.y * sy), natural.height);
  const width = Math.max(1, Math.min(crop.width * sx, natural.width - x));
  const height = Math.max(1, Math.min(crop.height * sy, natural.height - y));
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/** Output size of a crop: a preset forces its exact size (up- or downscale); a free crop is bounded by 1920 px. */
export function cropOutputSize(crop: Size, preset?: Pick<CropPreset, "width" | "height"> | null): Size {
  if (preset) return { width: preset.width, height: preset.height };
  return fitWithin(crop.width, crop.height);
}

/** Largest centered rect with `aspect` (w/h) inside `bounds`. */
export function maxAspectRect(bounds: Size, aspect: number): Rect {
  let w = bounds.width;
  let h = bounds.height;
  if (aspect > 0) {
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;
  }
  return { x: (bounds.width - w) / 2, y: (bounds.height - h) / 2, width: w, height: h };
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^/.]+$/, "") || "imagem";
  return `${base}.${ext}`;
}

/** Client-side validation (server re-checks magic bytes). Returns a pt-BR error or null. */
export function validateImageFile(file: { type: string; size: number; name: string }): string | null {
  const type = (file.type || "").toLowerCase();
  if (type === "image/svg+xml" || /\.svg$/i.test(file.name)) return "SVG não é permitido.";
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)) return "Formato não suportado (use JPEG, PNG, WebP ou GIF).";
  if (file.size > MAX_UPLOAD_BYTES) return `Arquivo maior que ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  return null;
}

/* ───────────────────────── browser-only ───────────────────────── */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))), mime, quality));
}

/** Draws `source` (natural px) into a canvas of `out` size and encodes it. WebP falls back to PNG when unsupported. */
export async function renderToFile(img: HTMLImageElement, source: Rect, out: Size, format: "webp" | "png" | "jpeg", quality: number, name: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.drawImage(img, source.x, source.y, source.width, source.height, 0, 0, out.width, out.height);
  const mime = `image/${format}`;
  const blob = await canvasToBlob(canvas, mime, format === "png" ? undefined : clampQuality(quality) / 100);
  // Browsers without WebP encoding silently return PNG.
  const actual = blob.type || mime;
  const ext = actual === "image/webp" ? "webp" : actual === "image/jpeg" ? "jpg" : "png";
  return new File([blob], replaceExtension(name, ext), { type: actual });
}

/**
 * "Otimizar": resizes to ≤ 1920 px and re-encodes as WebP. GIFs are kept (animation). On any failure the original
 * file is returned with `error` set (caller shows a toast and uploads the original, like the reference).
 */
export async function processImageFile(file: File, opts: { optimize: boolean; quality: number }): Promise<{ file: File; optimized: boolean; error?: string }> {
  if (!opts.optimize || file.type === "image/gif") return { file, optimized: false };
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const out = fitWithin(img.naturalWidth, img.naturalHeight);
    const result = await renderToFile(img, { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }, out, "webp", opts.quality, file.name);
    // Keep the original when it is already small, same size and re-encoding does not help.
    if (result.size >= file.size && out.width === img.naturalWidth && out.height === img.naturalHeight) return { file, optimized: false };
    return { file: result, optimized: true };
  } catch (e) {
    return { file, optimized: false, error: e instanceof Error ? e.message : "Falha na otimização" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type BlogMediaItem = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  size: number;
  mimeType: string;
  originalFilename: string;
  alt: string | null;
  createdAt?: string;
  deletedAt?: string | null;
  inUse?: boolean;
  usageCount?: number;
};

export type UploadOptions = { optimize?: boolean; format?: "webp" | "png"; quality?: number; alt?: string };

function uploadFields(opts: UploadOptions) {
  const f: Record<string, string> = {};
  if (opts.optimize) f.optimize = "true";
  if (opts.format) f.format = opts.format;
  if (opts.quality != null) f.quality = String(clampQuality(opts.quality));
  if (opts.alt) f.alt = opts.alt;
  return f;
}

function parseEnvelope<T>(status: number, text: string): T {
  let body: { ok?: boolean; data?: T; error?: { code: string; message: string; details?: unknown } } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  if (!body) throw new ApiClientError(status, "NETWORK", status === 404 ? "Endpoint de mídia do blog indisponível (404)." : "Resposta inválida do servidor");
  if (!body.ok || status >= 400) throw new ApiClientError(status, body.error?.code ?? "ERROR", body.error?.message ?? "Falha no envio", body.error?.details);
  return body.data as T;
}

/** Multipart upload via XHR (progress 0–100). Options go both as form fields and query (server reads either). */
export function uploadBlogMedia(file: File, opts: UploadOptions = {}, onProgress?: (pct: number) => void, signal?: AbortSignal): Promise<BlogMediaItem> {
  return new Promise((resolve, reject) => {
    const fields = uploadFields(opts);
    const fd = new FormData();
    fd.append("file", file);
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const qs = new URLSearchParams(fields).toString();
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1/admin/blog/media${qs ? `?${qs}` : ""}`, true);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        resolve(parseEnvelope<BlogMediaItem>(xhr.status, xhr.responseText));
      } catch (e) {
        reject(e);
      }
    };
    xhr.onerror = () => reject(new ApiClientError(0, "NETWORK", "Erro de rede ao enviar o arquivo."));
    xhr.onabort = () => reject(new ApiClientError(0, "ABORTED", "Envio cancelado."));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(fd);
  });
}

export type SizeEstimate = { pngSize: number | null; webpSize: number | null; width: number | null; height: number | null };

export async function estimateBlogMedia(file: File, quality: number, signal?: AbortSignal): Promise<SizeEstimate> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("quality", String(clampQuality(quality)));
  const res = await fetch(`/api/v1/admin/blog/media/estimate?quality=${clampQuality(quality)}`, { method: "POST", body: fd, credentials: "include", signal });
  return parseEnvelope<SizeEstimate>(res.status, await res.text());
}
