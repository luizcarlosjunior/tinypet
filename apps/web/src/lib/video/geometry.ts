/**
 * Pure geometry helpers for video processing and cover cropping (no browser APIs — unit tested in node).
 */
export type Rect = { x: number; y: number; width: number; height: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Largest rect with `aspect` (width / height) centered inside a `srcW`×`srcH` frame, in integer pixels.
 * Used for the center crop (cover-fit) of the source video before scaling to the output frame.
 */
export function centerCropRect(srcW: number, srcH: number, aspect: number): Rect {
  if (!(srcW > 0 && srcH > 0 && aspect > 0)) throw new Error("centerCropRect: invalid dimensions");
  let width = srcW;
  let height = srcW / aspect;
  if (height > srcH) {
    height = srcH;
    width = srcH * aspect;
  }
  width = Math.min(srcW, Math.round(width));
  height = Math.min(srcH, Math.round(height));
  const x = Math.floor((srcW - width) / 2);
  const y = Math.floor((srcH - height) / 2);
  return { x, y, width, height };
}

/** Pixel size of the cropper viewport for a given long side and aspect (width / height). */
export function viewportSize(longSide: number, aspect: number): { width: number; height: number } {
  if (aspect >= 1) return { width: longSide, height: Math.round(longSide / aspect) };
  return { width: Math.round(longSide * aspect), height: longSide };
}

/** Scale at which the image covers the viewport entirely (zoom = 1). */
export function coverScale(imgW: number, imgH: number, viewW: number, viewH: number): number {
  return Math.max(viewW / imgW, viewH / imgH);
}

/** Max pan offset (in viewport px) so the scaled image always covers the viewport. */
export function clampOffset(o: { x: number; y: number }, imgW: number, imgH: number, viewW: number, viewH: number, scale: number): { x: number; y: number } {
  const maxX = Math.max(0, (imgW * scale - viewW) / 2);
  const maxY = Math.max(0, (imgH * scale - viewH) / 2);
  return { x: clamp(o.x, -maxX, maxX), y: clamp(o.y, -maxY, maxY) };
}

/**
 * Crop rect in SOURCE-IMAGE pixels for what the cropper viewport shows.
 * The image is drawn centered in the viewport at `scale`, shifted by `offset`.
 * The result is clamped to the image and forced to exactly `aspect` (rounded to integer pixels).
 */
export function viewportCropRect(p: { imgW: number; imgH: number; viewW: number; viewH: number; scale: number; offset: { x: number; y: number }; aspect: number }): Rect {
  const { imgW, imgH, viewW, viewH, scale, offset, aspect } = p;
  const x0 = (viewW - imgW * scale) / 2 + offset.x;
  const y0 = (viewH - imgH * scale) / 2 + offset.y;
  let sx = clamp(-x0 / scale, 0, imgW);
  let sy = clamp(-y0 / scale, 0, imgH);
  let sw = Math.min(imgW - sx, viewW / scale);
  let sh = Math.min(imgH - sy, viewH / scale);
  // Force the exact aspect, shrinking the longer side around its center.
  if (sw / sh > aspect) {
    const w = sh * aspect;
    sx += (sw - w) / 2;
    sw = w;
  } else {
    const h = sw / aspect;
    sy += (sh - h) / 2;
    sh = h;
  }
  let width = Math.min(imgW, Math.max(1, Math.round(sw)));
  let height = Math.max(1, Math.round(width / aspect));
  if (height > imgH) {
    height = imgH;
    width = Math.max(1, Math.round(height * aspect));
  }
  const x = clamp(Math.round(sx), 0, imgW - width);
  const y = clamp(Math.round(sy), 0, imgH - height);
  return { x, y, width, height };
}

/** Scales `w`×`h` down (never up) so the long side is at most `maxPx`. */
export function fitWithin(w: number, h: number, maxPx: number): { width: number; height: number } {
  const s = Math.min(1, maxPx / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

/** True when `w / h` is within `tolerance` (relative) of `aspect`. */
export function matchesAspect(w: number, h: number, aspect: number, tolerance = 0.02): boolean {
  if (!(w > 0 && h > 0)) return false;
  return Math.abs(w / h - aspect) / aspect <= tolerance;
}
