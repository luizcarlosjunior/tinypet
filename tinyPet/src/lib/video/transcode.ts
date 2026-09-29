"use client";
/**
 * Client-side video transcoder → VIDEO_OUTPUT (MP4 · H.264 ≤ 1 Mbps · AAC ≤ 128 kbps · 720p/1080p · 16:9/9:16).
 * Primary engine: mediabunny (WebCodecs). Fallback: ffmpeg.wasm single-thread (see ./ffmpeg.ts).
 */
import { MEDIA_MAX_BYTES, VIDEO_OUTPUT, videoOutputSize, type VideoOutputSize } from "@tinypet/shared";
import { centerCropRect } from "./geometry";
import { cappedFrameRate, checkOutput, estimateOutputBytes, MSG_TOO_BIG, pickChannels, pickSampleRate, rotatedSize, VIDEO_ENCODE } from "./limits";
import { canceled, isCanceled, throwIfAborted, VideoProcessingError } from "./errors";
import { probeVideo, type VideoProbe } from "./probe";

export type VideoEngine = "webcodecs" | "ffmpeg";
export type TrimRange = { start: number; end: number };

export type TranscodedVideo = {
  file: File;
  width: number;
  height: number;
  label: VideoOutputSize["label"];
  orientation: VideoOutputSize["orientation"];
  durationSeconds: number;
  sizeBytes: number;
  hasAudio: boolean;
  engine: VideoEngine;
  videoBitrate: number | null;
  audioBitrate: number | null;
};

export type TranscodeOptions = {
  probe?: VideoProbe;
  trim?: TrimRange | null;
  onProgress?: (pct: number) => void;
  onEngine?: (engine: VideoEngine) => void;
  signal?: AbortSignal;
  /** Force an engine (debug/testing). */
  engine?: VideoEngine;
};

/** Hard cap on the SOURCE file (the browser must read it); the output is limited to MEDIA_MAX_BYTES. */
export const SOURCE_MAX_BYTES = 2 * 1024 * 1024 * 1024;

export async function transcodeVideo(file: File, opts: TranscodeOptions = {}): Promise<TranscodedVideo> {
  const { signal } = opts;
  if (file.size > SOURCE_MAX_BYTES) throw new VideoProcessingError("SOURCE_TOO_LARGE", "Arquivo de vídeo muito grande (máx. 2 GB).");
  let probe = opts.probe ?? (await probeVideo(file));
  throwIfAborted(signal);
  if (!probe.demuxable && (!probe.width || !probe.durationSeconds)) {
    const { probeWithFfmpeg } = await import("./ffmpeg");
    const p = await probeWithFfmpeg(file, signal);
    if (!p.width || !p.height) throw new VideoProcessingError("UNREADABLE", "Não foi possível ler este vídeo.");
    probe = { ...probe, ...rotatedSize(p.width, p.height, p.rotation), durationSeconds: p.durationSeconds ?? 0, rotation: p.rotation ?? 0 };
  }
  const target = videoOutputSize(probe.width, probe.height);
  const trim = opts.trim ?? null;
  const duration = trim ? trim.end - trim.start : probe.durationSeconds;
  if (duration > 0 && estimateOutputBytes(duration, probe.hasAudio) > MEDIA_MAX_BYTES) throw new VideoProcessingError("TOO_BIG", MSG_TOO_BIG);

  const engine = opts.engine ?? ((await canUseWebCodecs(probe, target)) ? "webcodecs" : "ffmpeg");

  if (engine === "webcodecs") {
    opts.onEngine?.("webcodecs");
    try {
      let result = await runMediabunny(file, probe, target, trim, VIDEO_ENCODE.videoBitrate, opts);
      if (!result.check.ok && (result.check.reason === "VIDEO_BITRATE" || result.check.reason === "TOTAL_BITRATE")) {
        // The hardware encoder overshot the target: one more pass at a lower bitrate.
        opts.onProgress?.(0);
        result = await runMediabunny(file, probe, target, trim, VIDEO_ENCODE.retryVideoBitrate, opts);
      }
      if (!result.check.ok) throw new VideoProcessingError(result.check.reason === "TOO_BIG" ? "TOO_BIG" : "INVALID_OUTPUT", result.check.message);
      return result.video;
    } catch (e) {
      if (isCanceled(e) || signal?.aborted) throw canceled();
      if (e instanceof VideoProcessingError && (e.code === "TOO_BIG" || e.code === "INVALID_OUTPUT")) throw e;
      console.warn("[video] WebCodecs conversion failed, falling back to ffmpeg.wasm", e);
    }
  }

  opts.onEngine?.("ffmpeg");
  opts.onProgress?.(0);
  const { transcodeWithFfmpeg } = await import("./ffmpeg");
  const bytes = await transcodeWithFfmpeg(file, target, { durationSeconds: probe.durationSeconds, trim, onProgress: opts.onProgress, signal });
  const out = await inspectOutput(bytes, file.name, "ffmpeg");
  const check = checkOutput(out);
  if (!check.ok) throw new VideoProcessingError(check.reason === "TOO_BIG" ? "TOO_BIG" : "INVALID_OUTPUT", check.message);
  return out;
}

/** WebCodecs path is used when the file can be demuxed/decoded and H.264 (+ AAC, natively or via the wasm extension) can be encoded. */
async function canUseWebCodecs(probe: VideoProbe, target: VideoOutputSize): Promise<boolean> {
  if (!probe.demuxable || typeof window === "undefined" || typeof window.VideoEncoder === "undefined" || typeof window.VideoDecoder === "undefined") return false;
  try {
    const mb = await import("mediabunny");
    const videoOk = await mb.canEncodeVideo("avc", { width: target.width, height: target.height, quality: new mb.Quality({ bitrate: VIDEO_ENCODE.videoBitrate }), frameRate: VIDEO_ENCODE.maxFrameRate });
    if (!videoOk) return false;
    if (!probe.hasAudio) return true;
    if (typeof window.AudioDecoder === "undefined" || typeof window.AudioData === "undefined") return false;
    const audioOpts = { numberOfChannels: pickChannels(probe.audioChannels), sampleRate: pickSampleRate(probe.audioSampleRate), quality: new mb.Quality({ bitrate: VIDEO_ENCODE.audioBitrate }) };
    if (await mb.canEncodeAudio("aac", audioOpts)) return true;
    // Chrome on Linux, Firefox, some Safari builds: no native AAC encoder → register the wasm AAC encoder.
    await ensureAacEncoder();
    return mb.canEncodeAudio("aac", audioOpts);
  } catch {
    return false;
  }
}

let aacRegistered: Promise<void> | null = null;
function ensureAacEncoder() {
  aacRegistered ??= import("@mediabunny/aac-encoder").then((m) => m.registerAacEncoder());
  return aacRegistered;
}

async function runMediabunny(file: File, probe: VideoProbe, target: VideoOutputSize, trim: TrimRange | null, videoBitrate: number, opts: TranscodeOptions) {
  const { signal } = opts;
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const target_ = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: target_ });
  const crop = centerCropRect(probe.width, probe.height, target.width / target.height);
  try {
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      tags: {}, // drop source metadata (GPS, device…)
      ...(trim ? { trim } : {}),
      video: {
        codec: "avc",
        width: target.width,
        height: target.height,
        fit: "cover",
        crop: { left: crop.x, top: crop.y, width: crop.width, height: crop.height },
        frameRate: cappedFrameRate(probe.frameRate),
        quality: new mb.Quality({ bitrate: videoBitrate }),
        keyFrameInterval: VIDEO_ENCODE.keyFrameIntervalSeconds,
        allowTransformationMetadata: false, // bake rotation so the stored frame is exactly W×H
        forceTranscode: true,
      },
      audio: probe.hasAudio
        ? { codec: "aac", numberOfChannels: pickChannels(probe.audioChannels), sampleRate: pickSampleRate(probe.audioSampleRate), quality: new mb.Quality({ bitrate: VIDEO_ENCODE.audioBitrate }), forceTranscode: true }
        : { discard: true },
    });
    if (!conversion.isValid) throw new VideoProcessingError("UNSUPPORTED", "Formato de vídeo não suportado neste navegador.", conversion.discardedTracks);
    if (probe.hasAudio && conversion.discardedTracks.some((d) => d.track.type === "audio")) throw new VideoProcessingError("UNSUPPORTED", "Áudio não suportado pelo conversor nativo.", conversion.discardedTracks);
    conversion.onProgress = (p) => opts.onProgress?.(Math.min(99, Math.round(p * 100)));
    const onAbort = () => void conversion.cancel();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      throwIfAborted(signal);
      await conversion.execute();
    } catch (e) {
      if (e instanceof mb.ConversionCanceledError || signal?.aborted) throw canceled();
      throw e;
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  } finally {
    input.dispose();
  }
  const buffer = target_.buffer;
  if (!buffer) throw new VideoProcessingError("ENGINE", "A conversão não gerou um arquivo.");
  const video = await inspectOutput(new Uint8Array(buffer), file.name, "webcodecs");
  opts.onProgress?.(100);
  return { video, check: checkOutput(video) };
}

/** Reads back the produced MP4 (demux only, no decoding) to verify frame, codecs and bitrates. */
async function inspectOutput(bytes: Uint8Array, sourceName: string, engine: VideoEngine): Promise<TranscodedVideo> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BufferSource(bytes), formats: [mb.MP4] });
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt || vt.codec !== VIDEO_OUTPUT.videoCodec) throw new VideoProcessingError("INVALID_OUTPUT", "O vídeo convertido não está em H.264.");
    const at = await input.getPrimaryAudioTrack();
    if (at && at.codec !== VIDEO_OUTPUT.audioCodec) throw new VideoProcessingError("INVALID_OUTPUT", "O áudio convertido não está em AAC.");
    const durationSeconds = await input.computeDuration();
    const vStats = await vt.computePacketStats().catch(() => null);
    const aStats = at ? await at.computePacketStats().catch(() => null) : null;
    const width = vt.displayWidth;
    const height = vt.displayHeight;
    const size = videoOutputSize(width, height);
    const base = sourceName.replace(/\.[^.]+$/, "").replace(/[^\w\-. ]+/g, "").trim().slice(0, 80) || "video";
    const file = new File([bytes as BlobPart], `${base}.mp4`, { type: VIDEO_OUTPUT.mimeType });
    return { file, width, height, label: size.label, orientation: size.orientation, durationSeconds, sizeBytes: file.size, hasAudio: !!at, engine, videoBitrate: vStats?.averageBitrate ?? null, audioBitrate: aStats?.averageBitrate ?? null };
  } finally {
    input.dispose();
  }
}
