"use client";
import { api } from "@/lib/api-client";
import type { z } from "zod";
import type { MediaPurposeEnum } from "@tinypet/shared";
import { isPlanLimit } from "@/lib/errors";
import type { TranscodedVideo } from "@/lib/video/transcode";

export type MediaPurpose = z.infer<typeof MediaPurposeEnum>;
export type CropRect = { x: number; y: number; width: number; height: number };
export type UploadedMedia = { id: string; url: string; thumbUrl: string | null; kind: "IMAGE" | "VIDEO"; width: number | null; height: number | null; sizeBytes: number };

type UploadTarget = { assetId: string; uploadUrl: string; method: "PUT"; headers?: Record<string, string>; url: string };

/** Reads intrinsic dimensions of an image (or, for diagnostics, a video) file in the browser. */
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
 * 3-step upload for IMAGES/PDFs: POST /media/upload → PUT bytes → POST /media/complete.
 * `crop` is in source-image pixels. Partner purposes need `partnerId` (falls back to the active partner).
 * Videos must go through `processAndUploadVideo` (client-side transcoding to VIDEO_OUTPUT first).
 */
export async function uploadFile(file: File, purpose: MediaPurpose, opts: { crop?: CropRect; partnerId?: string | null; onProgress?: (pct: number) => void; signal?: AbortSignal } = {}): Promise<UploadedMedia> {
  if (isVideoFile(file)) {
    throw new Error("uploadFile() não aceita vídeos: use processAndUploadVideo() (ou <VideoUploader>) para converter o vídeo no navegador antes do envio.");
  }
  const dims = await readMediaDimensions(file);
  return uploadRaw(file, purpose, { ...opts, dims });
}

/** True for video files (by MIME or, when the browser reports none, by extension). */
export function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return !file.type && /\.(mp4|m4v|mov|webm|mkv|3gp|3gpp|avi)$/i.test(file.name);
}

type RawOpts = { crop?: CropRect; partnerId?: string | null; onProgress?: (pct: number) => void; signal?: AbortSignal; dims: { width?: number; height?: number; durationSeconds?: number }; coverAssetId?: string };

async function uploadRaw(file: File, purpose: MediaPurpose, opts: RawOpts): Promise<UploadedMedia> {
  const partnerId = opts.partnerId;
  const p = partnerId !== undefined ? { partnerId } : {};
  const target = await api<UploadTarget>("/media/upload", {
    method: "POST",
    signal: opts.signal,
    json: { purpose, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, fileName: file.name, width: opts.dims.width, height: opts.dims.height, durationSeconds: opts.dims.durationSeconds },
    ...p,
  });
  opts.onProgress?.(10);
  await putBytes(target, file, (pct) => opts.onProgress?.(10 + Math.round(pct * 0.8)), opts.signal);
  opts.onProgress?.(90);
  const done = await api<UploadedMedia>("/media/complete", { method: "POST", signal: opts.signal, json: { assetId: target.assetId, crop: opts.crop, coverAssetId: opts.coverAssetId }, ...p });
  opts.onProgress?.(100);
  return done;
}

// ───────── video ─────────

/** Per-plan video limits (GET /media/limits). `videosPerDay`/`videoMaxSeconds` null = unlimited. */
export type MediaLimits = { audience: "OWNER" | "PARTNER"; planKey: string; videosPerDay: number | null; videosUsedToday: number; videoMaxSeconds: number | null; maxBytes: number };

/** Fetches the video limits of the current account. Pass `partnerId: null` for tutor (owner) uploads. */
export function fetchMediaLimits(partnerId?: string | null, signal?: AbortSignal): Promise<MediaLimits> {
  return api<MediaLimits>("/media/limits", { signal, ...(partnerId !== undefined ? { partnerId } : {}) });
}

/** Cover for a video: an image with an optional crop (source pixels, 16:9 or 9:16). */
export type VideoCoverInput = { file: Blob; crop?: CropRect; width?: number; height?: number };

export type VideoUploadStage = "limits" | "probe" | "transcode" | "cover" | "upload-cover" | "upload" | "done";
export type VideoUploadProgress = { stage: VideoUploadStage; pct: number; overall: number };

/** Uploads a video cover image (purpose VIDEO_COVER) and returns the READY cover asset. */
export async function uploadVideoCover(cover: VideoCoverInput, opts: { partnerId?: string | null; signal?: AbortSignal; onProgress?: (pct: number) => void } = {}): Promise<UploadedMedia> {
  const file = cover.file instanceof File ? cover.file : blobToFile(cover.file, "capa.jpg");
  const dims = cover.width && cover.height ? { width: cover.width, height: cover.height } : await readMediaDimensions(file);
  const crop = cover.crop ?? (dims.width && dims.height ? { x: 0, y: 0, width: dims.width, height: dims.height } : undefined);
  return uploadRaw(file, "VIDEO_COVER", { dims, crop, partnerId: opts.partnerId, signal: opts.signal, onProgress: opts.onProgress });
}

/** Changes the cover of an existing video asset (POST /media/:assetId/cover). */
export async function setVideoCover(assetId: string, cover: VideoCoverInput, opts: { partnerId?: string | null; signal?: AbortSignal } = {}): Promise<UploadedMedia> {
  const c = await uploadVideoCover(cover, opts);
  return api<UploadedMedia>(`/media/${encodeURIComponent(assetId)}/cover`, { method: "POST", signal: opts.signal, json: { coverAssetId: c.id }, ...(opts.partnerId !== undefined ? { partnerId: opts.partnerId } : {}) });
}

/**
 * Uploads an already-transcoded video (from `transcodeVideo`): cover first (VIDEO_COVER, cropped), then the MP4,
 * then `complete` with `coverAssetId`.
 */
export async function uploadTranscodedVideo(video: TranscodedVideo, purpose: MediaPurpose, opts: { partnerId?: string | null; cover?: VideoCoverInput | null; onProgress?: (p: VideoUploadProgress) => void; signal?: AbortSignal } = {}): Promise<UploadedMedia> {
  const report = (stage: VideoUploadStage, pct: number, from: number, to: number) => opts.onProgress?.({ stage, pct, overall: Math.round(from + ((to - from) * pct) / 100) });
  let coverAssetId: string | undefined;
  if (opts.cover) {
    const c = await uploadVideoCover(opts.cover, { partnerId: opts.partnerId, signal: opts.signal, onProgress: (pct) => report("upload-cover", pct, 0, 10) });
    coverAssetId = c.id;
  }
  const done = await uploadRaw(video.file, purpose, {
    partnerId: opts.partnerId,
    signal: opts.signal,
    coverAssetId,
    dims: { width: video.width, height: video.height, durationSeconds: Math.round(video.durationSeconds * 1000) / 1000 },
    onProgress: (pct) => report("upload", pct, 10, 100),
  });
  opts.onProgress?.({ stage: "done", pct: 100, overall: 100 });
  return done;
}

/**
 * Headless pipeline (no UI): check plan limits → probe → transcode to VIDEO_OUTPUT (trimmed to the plan's max duration
 * when `trimToPlan`) → default cover (frame at ~1 s) unless `cover` is given → upload cover + MP4 → complete.
 */
export async function processAndUploadVideo(file: File, purpose: MediaPurpose, opts: { partnerId?: string | null; cover?: VideoCoverInput | null; onProgress?: (p: VideoUploadProgress) => void; signal?: AbortSignal; trimToPlan?: boolean } = {}): Promise<UploadedMedia> {
  const v = await import("@/lib/video");
  const { signal } = opts;
  const report = (stage: VideoUploadStage, pct: number, from: number, to: number) => opts.onProgress?.({ stage, pct, overall: Math.round(from + ((to - from) * pct) / 100) });
  report("limits", 0, 0, 1);
  const limits = await fetchMediaLimits(opts.partnerId, signal).catch((e) => {
    if (isPlanLimit(e)) throw e;
    return null; // endpoint unavailable: the server still enforces the limits
  });
  if (limits) {
    const blocked = videoQuotaMessage(limits);
    if (blocked) throw new v.VideoProcessingError("PLAN_QUOTA", blocked);
  }
  report("probe", 0, 1, 3);
  const probe = await v.probeVideo(file);
  let trim: { start: number; end: number } | null = null;
  if (limits?.videoMaxSeconds && probe.durationSeconds > limits.videoMaxSeconds) {
    if (!opts.trimToPlan) throw new v.VideoProcessingError("PLAN_DURATION", videoDurationMessage(limits.videoMaxSeconds));
    trim = v.trimWindow(probe.durationSeconds, limits.videoMaxSeconds);
  }
  const video = await v.transcodeVideo(file, { probe, trim, signal, onProgress: (pct) => report("transcode", pct, 3, 80) });
  let cover = opts.cover ?? null;
  if (!cover) {
    report("cover", 0, 80, 82);
    const frame = await v.extractFrame(video.file, v.defaultCoverTime(video.durationSeconds)).catch(() => null);
    if (frame) cover = { file: frame.blob, width: frame.width, height: frame.height };
  }
  return uploadTranscodedVideo(video, purpose, {
    partnerId: opts.partnerId,
    cover,
    signal,
    onProgress: (p) => opts.onProgress?.({ ...p, overall: p.stage === "done" ? 100 : Math.round(82 + (18 * p.overall) / 100) }),
  });
}

/** pt-BR message when the daily video quota is used up, else null. */
export function videoQuotaMessage(l: MediaLimits): string | null {
  if (l.videosPerDay == null || l.videosUsedToday < l.videosPerDay) return null;
  const n = l.videosPerDay;
  return `Seu plano permite ${n} vídeo${n === 1 ? "" : "s"} por dia e você já enviou ${l.videosUsedToday} hoje. Tente novamente amanhã${l.planKey?.toLowerCase().includes("free") ? " ou faça upgrade para enviar mais" : ""}.`;
}

export function videoDurationMessage(maxSeconds: number): string {
  return `Seu plano permite vídeos de até ${maxSeconds} segundos.`;
}

function putBytes(target: UploadTarget, file: File, onProgress?: (pct: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Envio cancelado.", "AbortError"));
    const xhr = new XMLHttpRequest();
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.onabort = () => reject(new DOMException("Envio cancelado.", "AbortError"));
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
