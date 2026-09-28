"use client";
import { api } from "@/lib/api-client";
import type { z } from "zod";
import type { MediaPurposeEnum } from "@tinypet/shared";

export type MediaPurpose = z.infer<typeof MediaPurposeEnum>;
export type CropRect = { x: number; y: number; width: number; height: number };
export type UploadedMedia = { id: string; url: string; thumbUrl: string | null; kind: "IMAGE" | "VIDEO"; width: number | null; height: number | null; sizeBytes: number };

type UploadTarget = { assetId: string; uploadUrl: string; method: "PUT"; headers?: Record<string, string>; url: string };

/** Reads intrinsic dimensions of an image or video file in the browser. */
export async function readMediaDimensions(file: File): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
  if (typeof window === "undefined") return {};
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("video/")) {
      return await new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.style.position = "fixed";
        video.style.opacity = "0";
        video.style.pointerEvents = "none";
        video.onloadedmetadata = () => {
          const r = { width: video.videoWidth, height: video.videoHeight, durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined };
          video.remove();
          resolve(r);
        };
        video.onerror = () => {
          video.remove();
          resolve({});
        };
        document.body.appendChild(video);
        video.src = url;
      });
    }
    if (file.type.startsWith("image/")) {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({});
        img.src = url;
      });
    }
    return {};
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * 3-step upload: POST /media/upload → PUT bytes → POST /media/complete.
 * `crop` is in source-image pixels. Partner purposes need `partnerId` (falls back to the active partner).
 */
export async function uploadFile(file: File, purpose: MediaPurpose, opts: { crop?: CropRect; partnerId?: string | null; onProgress?: (pct: number) => void } = {}): Promise<UploadedMedia> {
  const dims = await readMediaDimensions(file);
  const partnerId = opts.partnerId;
  const target = await api<UploadTarget>("/media/upload", {
    method: "POST",
    json: { purpose, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, fileName: file.name, width: dims.width, height: dims.height, durationSeconds: dims.durationSeconds },
    ...(partnerId !== undefined ? { partnerId } : {}),
  });
  opts.onProgress?.(10);
  await putBytes(target, file, (p) => opts.onProgress?.(10 + Math.round(p * 0.8)));
  opts.onProgress?.(90);
  const done = await api<UploadedMedia>("/media/complete", { method: "POST", json: { assetId: target.assetId, crop: opts.crop }, ...(partnerId !== undefined ? { partnerId } : {}) });
  opts.onProgress?.(100);
  return done;
}

function putBytes(target: UploadTarget, file: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method || "PUT", target.uploadUrl, true);
    const headers = { "Content-Type": file.type || "application/octet-stream", ...(target.headers ?? {}) };
    for (const [k, v] of Object.entries(headers)) {
      try {
        xhr.setRequestHeader(k, v);
      } catch {
        /* browser-restricted header */
      }
    }
    xhr.withCredentials = target.uploadUrl.startsWith("/") || target.uploadUrl.startsWith(window.location.origin);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Falha ao enviar o arquivo (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Falha de rede ao enviar o arquivo"));
    xhr.send(file);
  });
}

/** Converts a canvas/Blob into a File so it can be uploaded. */
export function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}
