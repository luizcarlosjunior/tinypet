"use client";
import { VIDEO_COVER_MAX_PX } from "@tinypet/shared";
import { fitWithin, type Rect } from "./geometry";

export type CoverImage = { blob: Blob; width: number; height: number };

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a capa."))), "image/jpeg", quality));
}

/** Draws the current frame of a (same-origin/blob) <video> into a JPEG at most VIDEO_COVER_MAX_PX on the long side. */
export async function captureFrame(video: HTMLVideoElement, maxPx = VIDEO_COVER_MAX_PX): Promise<CoverImage> {
  const { width, height } = fitWithin(video.videoWidth, video.videoHeight, maxPx);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.drawImage(video, 0, 0, width, height);
  return { blob: await canvasToJpeg(canvas), width, height };
}

/** Extracts the frame at `atSeconds` of a video Blob (the transcoded MP4) as a JPEG cover. */
export function extractFrame(src: Blob, atSeconds: number, maxPx = VIDEO_COVER_MAX_PX): Promise<CoverImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao gerar a capa."));
    }, 15000);
    video.onloadeddata = () => {
      video.currentTime = Math.min(Math.max(0, atSeconds), Math.max(0, (video.duration || 0) - 0.05));
    };
    video.onseeked = async () => {
      try {
        // Some browsers paint the seeked frame one tick later.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        resolve(await captureFrame(video, maxPx));
      } catch (e) {
        reject(e);
      } finally {
        clearTimeout(timer);
        cleanup();
      }
    };
    video.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("Não foi possível ler o vídeo para gerar a capa."));
    };
    video.src = url;
  });
}

/** Renders `crop` (source pixels) of an image file into a JPEG preview (display only; the server crops the original). */
export async function cropPreview(file: Blob, crop: Rect, maxPx = 480): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Imagem inválida."));
      i.src = url;
    });
    const { width, height } = fitWithin(crop.width, crop.height, maxPx);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    return await canvasToJpeg(canvas, 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Natural size of an image Blob. */
export function imageSize(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      resolve({ width: i.naturalWidth, height: i.naturalHeight });
      URL.revokeObjectURL(url);
    };
    i.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem inválida."));
    };
    i.src = url;
  });
}
