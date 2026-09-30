"use client";
/**
 * Client-side photo pipeline for uploads: decode any image the user picks (JPEG, PNG, WebP, GIF, AVIF, BMP, HEIC/HEIF…),
 * crop, scale so the long side is ≤ MAX_UPLOAD_SIDE and encode to WebP before sending.
 * Canvas WebP encoding isn't available in Safari → falls back to the @jsquash/webp WASM encoder (loaded on demand).
 */

/** Long side (width or height) of every uploaded photo. */
export const MAX_UPLOAD_SIDE = 1920;
export const WEBP_QUALITY = 0.9;

export type Rect = { x: number; y: number; width: number; height: number };

/** `accept` for photo pickers: all images, plus HEIC/HEIF by extension (browsers often report no MIME for them). */
export const IMAGE_ACCEPT = "image/*,.heic,.heif,.avif";

export function isHeic(file: File) {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/") || isHeic(file) || /\.(jpe?g|png|webp|gif|avif|bmp|tiff?)$/i.test(file.name);
}

/** Converts HEIC/HEIF to JPEG (browsers other than Safari can't decode HEIC); other files are returned as-is. */
export async function decodableFile(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(out) ? out[0]! : out;
  return new File([blob], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" });
}

/** Loads a decodable file into an <img> (throws a pt-BR error when the browser can't read the format). */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir esta imagem. Use JPG, PNG, WebP, HEIC, GIF ou AVIF."));
    };
    img.src = url;
  });
}

/** Output size for a crop: the long side is at most `max`, aspect kept. */
export function scaledSize(width: number, height: number, max = MAX_UPLOAD_SIDE) {
  const k = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

async function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const native = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (native && native.type === "image/webp") return native;
  // Safari returns PNG for "image/webp": encode with the WASM codec instead.
  const ctx = canvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { encode } = await import("@jsquash/webp");
  const buf = await encode(data, { quality: Math.round(quality * 100) });
  return new Blob([buf], { type: "image/webp" });
}

/**
 * Crops `img` to `crop` (source pixels; whole image when omitted), scales to ≤ MAX_UPLOAD_SIDE and returns a WebP file.
 */
export async function toWebpFile(img: HTMLImageElement, name: string, crop?: Rect | null, quality = WEBP_QUALITY): Promise<File> {
  const src = crop ?? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
  const out = scaledSize(src.width, src.height);
  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, src.x, src.y, src.width, src.height, 0, 0, out.width, out.height);
  const blob = await canvasToWebp(canvas, quality);
  return new File([blob], `${name.replace(/\.[^.]+$/, "") || "foto"}.webp`, { type: "image/webp" });
}
