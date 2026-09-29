/**
 * Pure helpers for the video output rules (bitrates, size limit, formatting). No browser APIs.
 */
import { MEDIA_MAX_BYTES, VIDEO_OUTPUT, isAllowedVideoFrame } from "@tinypet/shared";

/** Encoder targets. Video stays below VIDEO_OUTPUT.maxVideoBitrate (1 Mbps) with headroom for VBR peaks. */
export const VIDEO_ENCODE = {
  videoBitrate: 950_000,
  /** Second attempt when the measured video bitrate overshoots the limit. */
  retryVideoBitrate: 700_000,
  audioBitrate: 128_000,
  maxFrameRate: 30,
  keyFrameIntervalSeconds: 2,
  maxAudioChannels: 2,
} as const;

export const MSG_TOO_BIG = "O vídeo ficou com mais de 10 MB. Envie um trecho mais curto (até cerca de 70 segundos).";

/** Estimated output bytes for a duration at the encoder targets (+2% container overhead). */
export function estimateOutputBytes(durationSeconds: number, hasAudio: boolean, videoBitrate: number = VIDEO_ENCODE.videoBitrate, audioBitrate: number = VIDEO_ENCODE.audioBitrate): number {
  const bps = videoBitrate + (hasAudio ? audioBitrate : 0);
  return Math.ceil(((durationSeconds * bps) / 8) * 1.02);
}

/** Longest duration (s) that fits MEDIA_MAX_BYTES at the encoder targets. */
export function maxDurationSeconds(hasAudio: boolean): number {
  const bps = VIDEO_ENCODE.videoBitrate + (hasAudio ? VIDEO_ENCODE.audioBitrate : 0);
  return Math.floor((MEDIA_MAX_BYTES * 8) / 1.02 / bps);
}

/** Average bitrate (bits/s) of `bytes` over `durationSeconds`. */
export function averageBitrate(bytes: number, durationSeconds: number): number {
  if (!(durationSeconds > 0)) return Infinity;
  return (bytes * 8) / durationSeconds;
}

/** Sample rate for the AAC output: keep 44.1/48 kHz sources, otherwise 48 kHz. */
export function pickSampleRate(source: number | null | undefined): 44100 | 48000 {
  return source === 44100 ? 44100 : 48000;
}

/** Stereo max. */
export function pickChannels(source: number | null | undefined): 1 | 2 {
  return source === 1 ? 1 : 2;
}

/** Frame-rate cap: returns 30 when the source is faster, else undefined (keep source timing). */
export function cappedFrameRate(sourceFps: number | null | undefined): number | undefined {
  if (!sourceFps || !Number.isFinite(sourceFps)) return undefined;
  return sourceFps > VIDEO_ENCODE.maxFrameRate + 0.5 ? VIDEO_ENCODE.maxFrameRate : undefined;
}

export type OutputCheck = { ok: true } | { ok: false; reason: "FRAME" | "TOO_BIG" | "VIDEO_BITRATE" | "AUDIO_BITRATE" | "TOTAL_BITRATE" | "DURATION"; message: string };

/**
 * Validates a transcoded file against VIDEO_OUTPUT (same rules the API enforces).
 * `videoBitrate`/`audioBitrate` are the measured per-track averages when known.
 */
export function checkOutput(o: { width: number; height: number; sizeBytes: number; durationSeconds: number; hasAudio: boolean; videoBitrate?: number | null; audioBitrate?: number | null }): OutputCheck {
  const tol = 1 + VIDEO_OUTPUT.bitrateTolerance;
  if (!isAllowedVideoFrame(o.width, o.height)) return { ok: false, reason: "FRAME", message: `Resolução de saída inválida (${o.width}×${o.height}).` };
  if (!(o.durationSeconds > 0)) return { ok: false, reason: "DURATION", message: "Não foi possível ler a duração do vídeo convertido." };
  if (o.sizeBytes > MEDIA_MAX_BYTES) return { ok: false, reason: "TOO_BIG", message: MSG_TOO_BIG };
  if (o.videoBitrate != null && o.videoBitrate > VIDEO_OUTPUT.maxVideoBitrate * tol) return { ok: false, reason: "VIDEO_BITRATE", message: "O vídeo convertido ficou acima de 1 Mbps." };
  if (o.audioBitrate != null && o.audioBitrate > VIDEO_OUTPUT.maxAudioBitrate * tol) return { ok: false, reason: "AUDIO_BITRATE", message: "O áudio convertido ficou acima de 128 kbps." };
  const maxTotal = (VIDEO_OUTPUT.maxVideoBitrate + (o.hasAudio ? VIDEO_OUTPUT.maxAudioBitrate : 0)) * tol;
  if (averageBitrate(o.sizeBytes, o.durationSeconds) > maxTotal) return { ok: false, reason: "TOTAL_BITRATE", message: "O vídeo convertido ficou acima do limite de 1 Mbps." };
  return { ok: true };
}

const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "5,1 MB" (MiB, like MEDIA_MAX_BYTES). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${nf1.format(bytes / (1024 * 1024))} MB`;
}

/** "42 s" / "1 min 05 s". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

/** "1280×720 · 720p · 42 s · 5,1 MB". */
export function formatVideoInfo(v: { width: number; height: number; label: string; durationSeconds: number; sizeBytes: number }): string {
  return `${v.width}×${v.height} · ${v.label} · ${formatDuration(v.durationSeconds)} · ${formatBytes(v.sizeBytes)}`;
}

/** ffmpeg.wasm (fallback engine) arguments for the VIDEO_OUTPUT target. */
export function ffmpegArgs(input: string, output: string, target: { width: number; height: number }, trim?: { start: number; end: number } | null): string[] {
  const { width: W, height: H } = target;
  const trimIn = trim && trim.start > 0 ? ["-ss", trim.start.toFixed(3)] : [];
  const trimOut = trim ? ["-t", Math.max(0.1, trim.end - trim.start).toFixed(3)] : [];
  const kbps = Math.round(VIDEO_ENCODE.videoBitrate / 1000);
  const maxKbps = Math.round(VIDEO_OUTPUT.maxVideoBitrate / 1000);
  return [
    ...trimIn,
    "-i", input,
    ...trimOut,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`,
    "-fpsmax", String(VIDEO_ENCODE.maxFrameRate),
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-preset", "veryfast",
    "-b:v", `${kbps}k`, "-maxrate", `${maxKbps}k`, "-bufsize", `${maxKbps * 2}k`,
    "-g", String(VIDEO_ENCODE.maxFrameRate * VIDEO_ENCODE.keyFrameIntervalSeconds),
    "-c:a", "aac", "-b:a", `${Math.round(VIDEO_ENCODE.audioBitrate / 1000)}k`, "-ac", "2", "-ar", "48000",
    "-map_metadata", "-1",
    "-movflags", "+faststart",
    "-y", output,
  ];
}

/** Parses "Duration: 00:01:02.50" and the first video stream "1920x1080" (+ rotation) out of ffmpeg logs. */
export function parseFfmpegProbe(log: string): { durationSeconds?: number; width?: number; height?: number; rotation?: number } {
  const r: { durationSeconds?: number; width?: number; height?: number; rotation?: number } = {};
  const d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(log);
  if (d) r.durationSeconds = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
  const v = /Stream #\d+:\d+[^\n]*Video:[^\n]*?\s(\d{2,5})x(\d{2,5})[\s,]/.exec(log);
  if (v) {
    r.width = Number(v[1]);
    r.height = Number(v[2]);
  }
  const rot = /rotation of (-?\d+(?:\.\d+)?) degrees/.exec(log) ?? /rotate\s*:\s*(-?\d+)/.exec(log);
  if (rot) r.rotation = ((Math.round(Number(rot[1])) % 360) + 360) % 360;
  return r;
}

/** Display size after applying a rotation of 90/270 degrees. */
export function rotatedSize(w: number, h: number, rotation: number | undefined): { width: number; height: number } {
  const r = (((rotation ?? 0) % 360) + 360) % 360;
  return r === 90 || r === 270 ? { width: h, height: w } : { width: w, height: h };
}

/** Timestamp (s) of the default cover frame: 1 s in, or the middle of very short clips. */
export function defaultCoverTime(durationSeconds: number): number {
  if (!(durationSeconds > 0)) return 0;
  return durationSeconds > 2 ? 1 : durationSeconds / 2;
}

/**
 * Trim window for a plan's max duration: `[start, start + maxSeconds]` clamped to the source,
 * or null when the source already fits.
 */
/** Safety margin below the plan limit: encoders round the last frame/audio packet up, so a cut at exactly N s can come out as N.03 s. */
export const TRIM_MARGIN_SECONDS = 0.25;

export function trimWindow(sourceSeconds: number, maxSeconds: number | null | undefined, start = 0): { start: number; end: number } | null {
  if (!maxSeconds || !(sourceSeconds > maxSeconds)) return null;
  const length = Math.max(1, maxSeconds - TRIM_MARGIN_SECONDS);
  const s = Math.min(Math.max(0, start), Math.max(0, sourceSeconds - length));
  return { start: s, end: s + length };
}

/** PLAN_LIMIT feature keys for the per-plan video limits (partner / owner). */
export const VIDEO_PLAN_FEATURES = {
  perDay: ["videos_per_day", "owner_videos_per_day"],
  maxSeconds: ["video_max_seconds", "owner_video_max_seconds"],
} as const;

/** pt-BR message for a 402 PLAN_LIMIT on the video limits, or null for other feature keys. */
export function videoPlanLimitMessage(l: { featureKey?: string; limit?: number | null; current?: number | null }): string | null {
  const key = l.featureKey ?? "";
  if ((VIDEO_PLAN_FEATURES.perDay as readonly string[]).includes(key)) {
    const n = l.limit ?? 0;
    return `Seu plano permite ${n} vídeo${n === 1 ? "" : "s"} por dia${l.current != null ? ` e você já enviou ${l.current} hoje` : ""}.`;
  }
  if ((VIDEO_PLAN_FEATURES.maxSeconds as readonly string[]).includes(key)) return `Seu plano permite vídeos de até ${l.limit ?? "—"} segundos.`;
  return null;
}
