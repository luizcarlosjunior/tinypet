/**
 * On-device video processing (runs BEFORE any upload).
 *
 * Every video is converted by the local native module `VideoTranscoder` (apps/mobile/modules/video-transcoder:
 * AVAssetReader/AVAssetWriter on iOS, Media3 Transformer on Android) to the shared VIDEO_OUTPUT contract:
 * MP4, H.264 + AAC, exactly 1920×1080 / 1280×720 (landscape, 16:9) or 1080×1920 / 720×1280 (portrait, 9:16)
 * with center crop, video ≈ 900 kbps (hard max 1 Mbps), ≤ 30 fps, keyframe every 2 s, AAC stereo 96 kbps.
 * The output is probed again and validated locally with the same rules the API applies on /media/complete.
 */
import * as FileSystem from "expo-file-system";
import * as VideoThumbnails from "expo-video-thumbnails";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { isAllowedVideoFrame, MEDIA_MAX_BYTES, VIDEO_COVER_MAX_PX, VIDEO_OUTPUT, videoOutputSize, type VideoOutputSize } from "@tinypet/shared";
import { VideoTranscoder, isVideoTranscoderAvailable, type TranscodeResult, type VideoProbe } from "../../../modules/video-transcoder";

export { isVideoTranscoderAvailable };
export type { VideoProbe };

/** Target average video bitrate. VBR encoders overshoot a little; the API allows +10% over 1 Mbps. */
export const VIDEO_TARGET_BITRATE = 900_000;
/** AAC stereo; ≤ VIDEO_OUTPUT.maxAudioBitrate (128 kbps). */
export const AUDIO_TARGET_BITRATE = 96_000;
export const VIDEO_MAX_FPS = 30;
export const VIDEO_KEYFRAME_SECONDS = 2;

export const VIDEO_TOO_LARGE_MESSAGE = "O vídeo ficou com mais de 10 MB. Envie um trecho mais curto (até cerca de 70 segundos).";

export type VideoProcessingErrorCode = "CANCELLED" | "TOO_LARGE" | "TOO_LONG" | "UNAVAILABLE" | "INVALID_SOURCE" | "FAILED";

export class VideoProcessingError extends Error {
  constructor(
    public code: VideoProcessingErrorCode,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "VideoProcessingError";
  }
}

export function isCancelled(e: unknown): boolean {
  return (e instanceof VideoProcessingError && e.code === "CANCELLED") || (e instanceof Error && e.name === "AbortError");
}

export type ProcessedVideo = {
  uri: string;
  mimeType: "video/mp4";
  width: number;
  height: number;
  orientation: VideoOutputSize["orientation"];
  durationSeconds: number;
  sizeBytes: number;
  videoBitrate: number;
  audioBitrate: number;
  hasAudio: boolean;
  /** Source duration (before trimming to the plan limit). */
  sourceDurationSeconds: number;
  trimmed: boolean;
};

export type VideoCover = { uri: string; width: number; height: number };

/** Reads display size (rotation applied), duration and codecs of a local video. */
export async function probeVideo(uri: string): Promise<VideoProbe> {
  if (!isVideoTranscoderAvailable()) throw new VideoProcessingError("UNAVAILABLE", "O processamento de vídeo não está disponível nesta versão do app. Atualize o aplicativo.");
  try {
    const p = await VideoTranscoder.probe(uri);
    if (!p.width || !p.height) throw new Error("no video track");
    return p;
  } catch (e) {
    if (e instanceof VideoProcessingError) throw e;
    throw new VideoProcessingError("INVALID_SOURCE", "Não foi possível ler este vídeo. Escolha outro arquivo.", e);
  }
}

/** Bytes a transcode of `seconds` will roughly produce (bitrate × duration + ~3% MP4 overhead). */
export function estimateOutputBytes(seconds: number, videoBitrate = VIDEO_TARGET_BITRATE): number {
  return Math.ceil((seconds * (videoBitrate + AUDIO_TARGET_BITRATE)) / 8 * 1.03);
}

let jobSeq = 0;

async function deleteQuietly(uri: string | undefined) {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}

async function runNative(uri: string, size: { width: number; height: number }, videoBitrate: number, maxDurationSeconds: number, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<TranscodeResult> {
  const jobId = `v${Date.now().toString(36)}-${++jobSeq}`;
  const sub = onProgress ? VideoTranscoder.onProgress(jobId, onProgress) : null;
  const onAbort = () => {
    VideoTranscoder.cancel(jobId).catch(() => undefined);
  };
  signal?.addEventListener("abort", onAbort);
  try {
    return await VideoTranscoder.transcode({
      jobId,
      uri,
      width: size.width,
      height: size.height,
      videoBitrate,
      audioBitrate: AUDIO_TARGET_BITRATE,
      maxFrameRate: VIDEO_MAX_FPS,
      keyFrameIntervalSeconds: VIDEO_KEYFRAME_SECONDS,
      maxDurationSeconds,
    });
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (signal?.aborted || code === "ERR_CANCELLED") throw new VideoProcessingError("CANCELLED", "Processamento cancelado.", e);
    throw new VideoProcessingError("FAILED", "Não foi possível converter o vídeo neste aparelho. Tente outro vídeo.", e);
  } finally {
    sub?.remove();
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Transcodes a picked video to the VIDEO_OUTPUT contract.
 * - `maxDurationSeconds`: plan limit; when the source is longer, only the first N seconds are kept
 *   (pass `trimToMax: true` after the user confirmed "Usar os primeiros N segundos"; otherwise TOO_LONG is thrown).
 * - `onProgress`: 0..1 while transcoding. `signal`: aborts the native job.
 */
export async function transcodeVideo(
  uri: string,
  opts: { maxDurationSeconds?: number | null; trimToMax?: boolean; onProgress?: (p: number) => void; signal?: AbortSignal; probe?: VideoProbe } = {},
): Promise<ProcessedVideo> {
  const { signal, onProgress } = opts;
  if (signal?.aborted) throw new VideoProcessingError("CANCELLED", "Processamento cancelado.");
  const src = opts.probe ?? (await probeVideo(uri));
  const limit = opts.maxDurationSeconds && opts.maxDurationSeconds > 0 ? opts.maxDurationSeconds : 0;
  const tooLong = limit > 0 && src.durationSeconds > limit + 0.05;
  if (tooLong && !opts.trimToMax) {
    throw new VideoProcessingError("TOO_LONG", `Este vídeo tem ${Math.ceil(src.durationSeconds)} s. Seu plano permite vídeos de até ${limit} s.`);
  }
  const effectiveDuration = tooLong ? limit : src.durationSeconds;
  if (estimateOutputBytes(effectiveDuration) > MEDIA_MAX_BYTES) throw new VideoProcessingError("TOO_LARGE", VIDEO_TOO_LARGE_MESSAGE);

  const primary = videoOutputSize(src.width, src.height);
  const [w720, h720] = VIDEO_OUTPUT.sizes["720p"][primary.orientation];
  const fallback720 = { width: w720, height: h720 };
  // Attempts: requested frame at the target bitrate; lower bitrate if the encoder overshot; 720p if the encoder
  // could not produce the 1080p frame exactly (Android encoder fallback).
  let size: { width: number; height: number } = primary;
  let bitrate = VIDEO_TARGET_BITRATE;
  let lastError: VideoProcessingError | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const out = await runNative(uri, size, bitrate, tooLong ? limit : 0, onProgress, signal);
    const problem = validateOutput(out, size, tooLong ? limit : src.durationSeconds);
    if (!problem) {
      onProgress?.(1);
      return {
        uri: out.uri,
        mimeType: "video/mp4",
        width: out.width,
        height: out.height,
        orientation: out.width >= out.height ? "landscape" : "portrait",
        durationSeconds: Math.round(out.durationSeconds * 1000) / 1000,
        sizeBytes: out.sizeBytes,
        videoBitrate: out.videoBitrate,
        audioBitrate: out.audioBitrate,
        hasAudio: out.hasAudio,
        sourceDurationSeconds: src.durationSeconds,
        trimmed: tooLong,
      };
    }
    await deleteQuietly(out.uri);
    if (problem === "TOO_LARGE") throw new VideoProcessingError("TOO_LARGE", VIDEO_TOO_LARGE_MESSAGE);
    lastError = new VideoProcessingError("FAILED", `O vídeo convertido não atende ao padrão (${problem}). Tente outro vídeo.`);
    if (problem === "FRAME" && size.width !== fallback720.width) size = fallback720;
    else if (problem === "VIDEO_BITRATE") bitrate = Math.round(bitrate * 0.75);
    else break;
  }
  throw lastError ?? new VideoProcessingError("FAILED", "Não foi possível converter o vídeo.");
}

type OutputProblem = "TOO_LARGE" | "FRAME" | "VIDEO_BITRATE" | "AUDIO_BITRATE" | "CODEC" | "DURATION";

function validateOutput(out: TranscodeResult, size: { width: number; height: number }, expectedDuration: number): OutputProblem | null {
  if (out.sizeBytes > MEDIA_MAX_BYTES) return "TOO_LARGE";
  if (out.width !== size.width || out.height !== size.height || !isAllowedVideoFrame(out.width, out.height)) return "FRAME";
  if (out.videoCodec !== "avc1") return "CODEC";
  if (out.hasAudio && out.audioCodec !== "mp4a") return "CODEC";
  // Stay under the hard cap ourselves (the API tolerates +10%, we don't rely on it).
  if (out.videoBitrate > VIDEO_OUTPUT.maxVideoBitrate) return "VIDEO_BITRATE";
  if (out.audioBitrate > VIDEO_OUTPUT.maxAudioBitrate * (1 + VIDEO_OUTPUT.bitrateTolerance)) return "AUDIO_BITRATE";
  if (out.durationSeconds <= 0 || out.durationSeconds > expectedDuration + 1) return "DURATION";
  return null;
}

/** Resizes an image already at the video aspect to the cover size (long side VIDEO_COVER_MAX_PX, exact 16:9 / 9:16). */
export function coverSizeFor(orientation: VideoOutputSize["orientation"]): { width: number; height: number } {
  const long = VIDEO_COVER_MAX_PX;
  const short = Math.round((long * 9) / 16);
  return orientation === "landscape" ? { width: long, height: short } : { width: short, height: long };
}

/** Default cover: a frame at ~1 s of the OUTPUT file, resized to the cover size. */
export async function extractDefaultCover(video: Pick<ProcessedVideo, "uri" | "durationSeconds" | "orientation">): Promise<VideoCover> {
  const timeMs = Math.round(Math.min(1000, Math.max(0, (video.durationSeconds * 1000) / 2)));
  const thumb = await VideoThumbnails.getThumbnailAsync(video.uri, { time: timeMs, quality: 0.9 });
  const target = coverSizeFor(video.orientation);
  const out = await manipulateAsync(thumb.uri, [{ resize: target }], { compress: 0.85, format: SaveFormat.JPEG });
  if (thumb.uri !== out.uri) deleteQuietly(thumb.uri);
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Crop rect in SOURCE pixels (expo-image-manipulator `crop` action shape). */
export type CropRect = { originX: number; originY: number; width: number; height: number };

/**
 * Normalizes a picked cover image: bakes EXIF orientation (so width/height are the displayed ones) and caps
 * the long side at 2560 px to keep the cropper light. Returns the image the cropper works on.
 */
export async function prepareCoverSource(uri: string): Promise<VideoCover> {
  const probe = await manipulateAsync(uri, [], { format: SaveFormat.JPEG, compress: 1 });
  const long = Math.max(probe.width, probe.height);
  if (long <= 2560) return { uri: probe.uri, width: probe.width, height: probe.height };
  const resize = probe.width >= probe.height ? { width: 2560 } : { height: 2560 };
  const out = await manipulateAsync(probe.uri, [{ resize }], { format: SaveFormat.JPEG, compress: 0.95 });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Crops the cover on the device and resizes to the exact cover size for the video orientation. */
export async function cropCover(source: VideoCover, rect: CropRect, orientation: VideoOutputSize["orientation"]): Promise<VideoCover> {
  const target = coverSizeFor(orientation);
  const crop = clampRect(rect, source.width, source.height);
  const out = await manipulateAsync(source.uri, [{ crop }, { resize: target }], { compress: 0.85, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

function clampRect(r: CropRect, w: number, h: number): CropRect {
  const width = Math.max(1, Math.min(Math.round(r.width), w));
  const height = Math.max(1, Math.min(Math.round(r.height), h));
  const originX = Math.max(0, Math.min(Math.round(r.originX), w - width));
  const originY = Math.max(0, Math.min(Math.round(r.originY), h - height));
  return { originX, originY, width, height };
}
