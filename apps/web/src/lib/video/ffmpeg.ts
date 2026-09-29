"use client";
/**
 * Fallback engine: single-thread ffmpeg.wasm (libx264 + aac), served from our origin under /ffmpeg/
 * (copied by scripts/copy-ffmpeg-core.mjs). Loaded lazily, only when WebCodecs can't do the job.
 */
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { ffmpegArgs, parseFfmpegProbe } from "./limits";
import { canceled, VideoProcessingError } from "./errors";

const BASE = "/ffmpeg";

async function createFFmpeg(signal?: AbortSignal): Promise<FFmpeg> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const ff = new FFmpeg();
  const origin = window.location.origin;
  try {
    await ff.load(
      {
        // Absolute URLs: the worker is our static copy (its dynamic import() runs natively, not through webpack).
        classWorkerURL: `${origin}${BASE}/worker.js`,
        coreURL: `${origin}${BASE}/ffmpeg-core.js`,
        wasmURL: `${origin}${BASE}/ffmpeg-core.wasm`,
      },
      { signal },
    );
  } catch (e) {
    ff.terminate();
    if (signal?.aborted) throw canceled();
    throw new VideoProcessingError("ENGINE", "Não foi possível carregar o conversor de vídeo deste navegador.", e);
  }
  return ff;
}

async function mountSource(ff: FFmpeg, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4";
  const safe = new File([file], `source.${ext}`, { type: file.type });
  await ff.createDir("/in").catch(() => undefined);
  // WORKERFS reads the File lazily instead of copying it into wasm memory.
  const { FFFSType } = await import("@ffmpeg/ffmpeg");
  await ff.mount(FFFSType.WORKERFS, { files: [safe] }, "/in");
  return `/in/${safe.name}`;
}

/** Last-resort probe (when neither mediabunny nor <video> can read the file). */
export async function probeWithFfmpeg(file: File, signal?: AbortSignal) {
  const ff = await createFFmpeg(signal);
  try {
    const path = await mountSource(ff, file);
    let log = "";
    ff.on("log", ({ message }) => (log += `${message}\n`));
    await ff.exec(["-hide_banner", "-i", path], undefined, { signal }).catch(() => 1);
    return parseFfmpegProbe(log);
  } finally {
    ff.terminate();
  }
}

export async function transcodeWithFfmpeg(file: File, target: { width: number; height: number }, opts: { durationSeconds: number; trim?: { start: number; end: number } | null; onProgress?: (pct: number) => void; signal?: AbortSignal }): Promise<Uint8Array> {
  const { signal } = opts;
  if (signal?.aborted) throw canceled();
  const ff = await createFFmpeg(signal);
  const onAbort = () => ff.terminate();
  signal?.addEventListener("abort", onAbort, { once: true });
  const total = opts.trim ? opts.trim.end - opts.trim.start : opts.durationSeconds;
  const tail: string[] = [];
  try {
    const path = await mountSource(ff, file);
    ff.on("progress", ({ progress, time }) => {
      // `time` is in microseconds of output; `progress` can be unreliable for some containers.
      const p = time > 0 && total > 0 ? time / 1e6 / total : progress;
      if (Number.isFinite(p)) opts.onProgress?.(Math.max(0, Math.min(99, Math.round(p * 100))));
    });
    ff.on("log", ({ message }) => {
      tail.push(message);
      if (tail.length > 30) tail.shift();
    });
    const code = await ff.exec(ffmpegArgs(path, "/out.mp4", target, opts.trim), undefined, { signal });
    if (code !== 0) throw new VideoProcessingError("ENGINE", "Falha ao converter o vídeo neste navegador.", tail.join("\n"));
    const data = await ff.readFile("/out.mp4");
    if (typeof data === "string") throw new VideoProcessingError("ENGINE", "Falha ao ler o vídeo convertido.");
    opts.onProgress?.(100);
    return data;
  } catch (e) {
    if (signal?.aborted) throw canceled();
    if (e instanceof VideoProcessingError) throw e;
    throw new VideoProcessingError("ENGINE", "Falha ao converter o vídeo neste navegador.", e);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    ff.terminate();
  }
}
