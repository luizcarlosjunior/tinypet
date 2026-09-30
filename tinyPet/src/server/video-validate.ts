import { Input, BufferSource, MP4, QTFF, type InputTrack } from "mediabunny";
import { VIDEO_OUTPUT, VIDEO_MIME, VIDEO_ASPECT_TOLERANCE, MEDIA_MAX_BYTES, isAllowedVideoFrame } from "@tinypet/shared";

/**
 * Server-side enforcement of the client transcoding contract (VIDEO_OUTPUT): every uploaded video must already be
 * MP4 · H.264 · AAC · 1080p/720p · 16:9 or 9:16 · ≤ 1 Mbps video · ≤ 128 kbps audio.
 * Parsing uses mediabunny (pure JS, reads the in-memory buffer only — no decoding, no WebCodecs).
 */

/** Machine-readable reasons, sent as `error.details.reason` on 400 responses. */
export type VideoRejectReason =
  | "VIDEO_FORMAT"
  | "VIDEO_FRAME"
  | "VIDEO_DURATION"
  | "VIDEO_TOO_LARGE"
  | "VIDEO_INVALID"
  | "VIDEO_TRACKS"
  | "VIDEO_CODEC"
  | "AUDIO_CODEC"
  | "VIDEO_DIMENSIONS_MISMATCH"
  | "VIDEO_BITRATE"
  | "AUDIO_BITRATE"
  | "COVER_ASPECT";

export const VIDEO_MESSAGES: Record<VideoRejectReason, string> = {
  VIDEO_FORMAT: "Converta o vídeo para MP4 1080p ou 720p (16:9 ou 9:16) antes de enviar",
  VIDEO_FRAME: "Converta o vídeo para MP4 1080p ou 720p (16:9 ou 9:16) antes de enviar",
  VIDEO_DURATION: "Informe a duração do vídeo (durationSeconds maior que zero)",
  VIDEO_TOO_LARGE: "Vídeo acima de 10 MB após a conversão; envie um trecho mais curto (até ~70 s)",
  VIDEO_INVALID: "Vídeo inválido ou corrompido",
  VIDEO_TRACKS: "O vídeo precisa ter exatamente uma faixa de vídeo e no máximo uma de áudio",
  VIDEO_CODEC: "O vídeo precisa estar em H.264 (MP4). Converta o vídeo antes de enviar",
  AUDIO_CODEC: "O áudio do vídeo precisa estar em AAC. Converta o vídeo antes de enviar",
  VIDEO_DIMENSIONS_MISMATCH: "As dimensões do vídeo não correspondem às informadas no envio",
  VIDEO_BITRATE: "Taxa de bits do vídeo acima de 1 Mbps. Converta o vídeo antes de enviar",
  AUDIO_BITRATE: "Taxa de bits do áudio acima de 128 kbps. Converta o vídeo antes de enviar",
  COVER_ASPECT: "A capa precisa ter a mesma proporção do vídeo (16:9 ou 9:16)",
};

export class VideoRejectError extends Error {
  constructor(
    public reason: VideoRejectReason,
    public details: Record<string, unknown> = {},
  ) {
    super(VIDEO_MESSAGES[reason]);
  }
}

/** Upload-request (step 1) checks for a video: format, declared frame and duration, size cap. Throws VideoRejectError. */
export function assertVideoUploadRequest(req: { mimeType: string; sizeBytes: number; width?: number; height?: number; durationSeconds?: number }) {
  if (!(VIDEO_MIME as readonly string[]).includes(req.mimeType)) throw new VideoRejectError("VIDEO_FORMAT", { mimeType: req.mimeType });
  if (!req.width || !req.height || !isAllowedVideoFrame(req.width, req.height)) throw new VideoRejectError("VIDEO_FRAME", { width: req.width ?? null, height: req.height ?? null });
  if (!(typeof req.durationSeconds === "number" && req.durationSeconds > 0)) throw new VideoRejectError("VIDEO_DURATION");
  if (req.sizeBytes > MEDIA_MAX_BYTES) throw new VideoRejectError("VIDEO_TOO_LARGE", { sizeBytes: req.sizeBytes, maxBytes: MEDIA_MAX_BYTES });
}

/** True when `ratio` is 16:9 or 9:16 within VIDEO_ASPECT_TOLERANCE (2%). */
export function isVideoAspect(width: number, height: number): boolean {
  if (!(width > 0 && height > 0)) return false;
  const r = width / height;
  return [16 / 9, 9 / 16].some((t) => Math.abs(r - t) / t <= VIDEO_ASPECT_TOLERANCE);
}

/** True when both rectangles have the same aspect within VIDEO_ASPECT_TOLERANCE. */
export function sameAspect(a: { width: number; height: number }, b: { width: number; height: number }): boolean {
  if (!(a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0)) return false;
  const ra = a.width / a.height;
  const rb = b.width / b.height;
  return Math.abs(ra - rb) / rb <= VIDEO_ASPECT_TOLERANCE;
}

export type VideoInfo = {
  /** Display size (rotation matrix applied). */
  width: number;
  height: number;
  durationSeconds: number;
  videoCodec: string;
  audioCodec: string | null;
  /** Measured average bitrates (bits/s) from the real sample sizes. */
  videoBitrate: number;
  audioBitrate: number | null;
};

const maxVideoBps = VIDEO_OUTPUT.maxVideoBitrate * (1 + VIDEO_OUTPUT.bitrateTolerance);
const maxAudioBps = VIDEO_OUTPUT.maxAudioBitrate * (1 + VIDEO_OUTPUT.bitrateTolerance);
/** Whole-file cap: both streams at their max + tolerance, plus a fixed allowance for the container (moov etc.). */
const CONTAINER_ALLOWANCE_BYTES = 64 * 1024;

/**
 * Upper bound of samples per track: ≤ 60 s (longest plan) at ≤ 60 fps video / ~47 fps AAC, with generous margin.
 * A crafted MP4 can declare billions of samples in a few bytes (stts/ctts counts), which makes the demuxer allocate
 * one object per sample and crash the process (heap out of memory) — this guard runs before it.
 */
export const MAX_SAMPLES_PER_TRACK = 20_000;

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "moof", "traf", "mvex", "udta"]);

/**
 * Walks the ISO-BMFF box tree (no allocation per sample) and rejects files whose sample tables declare more samples
 * than MAX_SAMPLES_PER_TRACK, or more sample bytes than the file holds. Throws VideoRejectError("VIDEO_INVALID").
 */
export function assertSaneMp4Tables(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (o: number) => view.getUint32(o);
  const type = (o: number) => String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);
  const bad = (why: string) => {
    throw new VideoRejectError("VIDEO_INVALID", { why });
  };
  let boxes = 0;
  const walk = (start: number, end: number, depth: number) => {
    if (depth > 12) bad("depth");
    let o = start;
    while (o + 8 <= end) {
      if (++boxes > 10_000) bad("boxes");
      let size = u32(o);
      const t = type(o + 4);
      let header = 8;
      if (size === 1) {
        if (o + 16 > end) bad("size64");
        const hi = u32(o + 8);
        size = hi * 2 ** 32 + u32(o + 12);
        header = 16;
      } else if (size === 0) size = end - o;
      if (size < header || o + size > end) bad(`box ${t}`);
      const body = o + header;
      const boxEnd = o + size;
      if (CONTAINERS.has(t)) walk(body, boxEnd, depth + 1);
      else if (t === "stts" || t === "ctts") {
        // full box: version/flags(4) + entry_count(4) + entries of (sample_count(4), value(4))
        if (body + 8 > boxEnd) bad(t);
        const entries = u32(body + 4);
        if (entries > MAX_SAMPLES_PER_TRACK || body + 8 + entries * 8 > boxEnd) bad(`${t} entries`);
        let total = 0;
        for (let i = 0; i < entries; i++) {
          total += u32(body + 8 + i * 8);
          if (total > MAX_SAMPLES_PER_TRACK) bad(`${t} samples`);
        }
      } else if (t === "stsz") {
        if (body + 12 > boxEnd) bad("stsz");
        const sampleSize = u32(body + 4);
        const count = u32(body + 8);
        if (count > MAX_SAMPLES_PER_TRACK) bad("stsz count");
        if (sampleSize > 0 && sampleSize * count > bytes.byteLength) bad("stsz bytes");
        if (sampleSize === 0 && body + 12 + count * 4 > boxEnd) bad("stsz table");
      } else if (t === "trun") {
        if (body + 8 > boxEnd) bad("trun");
        if (u32(body + 4) > MAX_SAMPLES_PER_TRACK) bad("trun samples");
      }
      o = boxEnd;
    }
  };
  walk(0, bytes.byteLength, 0);
}

/**
 * Parses an MP4 held in memory and validates it against VIDEO_OUTPUT. Throws VideoRejectError on any violation.
 * `declared` is the width/height sent in the upload request; the real display size must match it exactly.
 */
export async function validateMp4(bytes: Uint8Array, declared?: { width?: number | null; height?: number | null }): Promise<VideoInfo> {
  if (bytes.byteLength > MEDIA_MAX_BYTES) throw new VideoRejectError("VIDEO_TOO_LARGE", { sizeBytes: bytes.byteLength });
  // Only ISO-BMFF files are walked; anything else is reported as VIDEO_FORMAT by the demuxer check below.
  if (bytes.byteLength >= 8 && String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp") assertSaneMp4Tables(bytes);
  const input = new Input({ source: new BufferSource(bytes), formats: [MP4, QTFF] });
  try {
    let format;
    try {
      format = await input.getFormat();
    } catch {
      throw new VideoRejectError("VIDEO_FORMAT");
    }
    if (format !== MP4) throw new VideoRejectError("VIDEO_FORMAT", { container: format.name });

    let tracks: InputTrack[];
    try {
      tracks = await input.getTracks();
    } catch {
      throw new VideoRejectError("VIDEO_INVALID");
    }
    const videos = tracks.filter((t) => t.isVideoTrack());
    const audios = tracks.filter((t) => t.isAudioTrack());
    if (videos.length !== 1 || audios.length > 1 || tracks.length !== videos.length + audios.length) {
      throw new VideoRejectError("VIDEO_TRACKS", { video: videos.length, audio: audios.length, total: tracks.length });
    }
    const video = videos[0]!;
    if (!video.isVideoTrack()) throw new VideoRejectError("VIDEO_INVALID");
    const audio = audios[0] ?? null;

    const videoCodec = await video.getCodec();
    if (videoCodec !== "avc") throw new VideoRejectError("VIDEO_CODEC", { codec: videoCodec ?? (await video.getCodecParameterString().catch(() => null)) });
    const audioCodec = audio ? await audio.getCodec() : null;
    if (audio && audioCodec !== "aac") throw new VideoRejectError("AUDIO_CODEC", { codec: audioCodec });

    const width = await video.getDisplayWidth();
    const height = await video.getDisplayHeight();
    if (!isAllowedVideoFrame(width, height)) throw new VideoRejectError("VIDEO_FRAME", { width, height });
    if (declared && (declared.width !== width || declared.height !== height)) {
      throw new VideoRejectError("VIDEO_DIMENSIONS_MISMATCH", { width, height, declaredWidth: declared.width ?? null, declaredHeight: declared.height ?? null });
    }

    let videoStats, audioStats, durationSeconds: number;
    try {
      videoStats = await video.computePacketStats();
      audioStats = audio ? await audio.computePacketStats() : null;
      const vStart = await video.getFirstTimestamp();
      const vEnd = await video.computeDuration();
      const aEnd = audio ? await audio.computeDuration() : 0;
      durationSeconds = Math.max(vEnd - Math.min(0, vStart), aEnd);
    } catch {
      throw new VideoRejectError("VIDEO_INVALID");
    }
    if (!(durationSeconds > 0) || videoStats.packetCount === 0) throw new VideoRejectError("VIDEO_DURATION");

    const videoBitrate = Math.round(videoStats.averageBitrate);
    const audioBitrate = audioStats ? Math.round(audioStats.averageBitrate) : null;
    if (!Number.isFinite(videoBitrate) || videoBitrate > maxVideoBps) throw new VideoRejectError("VIDEO_BITRATE", { bitrate: videoBitrate, max: VIDEO_OUTPUT.maxVideoBitrate });
    if (audioBitrate != null && (!Number.isFinite(audioBitrate) || audioBitrate > maxAudioBps)) {
      throw new VideoRejectError("AUDIO_BITRATE", { bitrate: audioBitrate, max: VIDEO_OUTPUT.maxAudioBitrate });
    }
    // Whole-file bitrate: guards against bytes hidden outside the tracks' samples (padding, unknown boxes).
    const fileCap = ((maxVideoBps + maxAudioBps) * durationSeconds) / 8 + CONTAINER_ALLOWANCE_BYTES;
    if (bytes.byteLength > fileCap) throw new VideoRejectError("VIDEO_BITRATE", { fileBytes: bytes.byteLength, maxFileBytes: Math.floor(fileCap) });

    return { width, height, durationSeconds: Math.round(durationSeconds * 1000) / 1000, videoCodec: "avc", audioCodec: audio ? "aac" : null, videoBitrate, audioBitrate };
  } finally {
    input.dispose();
  }
}
