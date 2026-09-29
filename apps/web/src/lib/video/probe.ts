"use client";
import { VideoProcessingError } from "./errors";

export type VideoProbe = {
  /** Display size (rotation applied). */
  width: number;
  height: number;
  durationSeconds: number;
  rotation: number;
  hasAudio: boolean;
  frameRate?: number;
  audioChannels?: number;
  audioSampleRate?: number;
  videoCodec?: string | null;
  audioCodec?: string | null;
  /** True when mediabunny could demux the file (needed for the WebCodecs engine). */
  demuxable: boolean;
};

/** Reads duration, display size, rotation and tracks of a source video (mediabunny, then a hidden <video>). */
export async function probeVideo(file: File): Promise<VideoProbe> {
  const viaMb = await probeWithMediabunny(file).catch(() => null);
  if (viaMb) return viaMb;
  const viaEl = await probeWithElement(file);
  if (viaEl) return viaEl;
  throw new VideoProcessingError("UNREADABLE", "Não foi possível ler este vídeo. Tente outro arquivo (MP4, MOV, WebM, MKV ou 3GP).");
}

async function probeWithMediabunny(file: File): Promise<VideoProbe | null> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt) throw new VideoProcessingError("NO_VIDEO", "O arquivo não tem uma faixa de vídeo.");
    const at = await input.getPrimaryAudioTrack();
    const durationSeconds = await input.computeDuration();
    let frameRate: number | undefined;
    try {
      frameRate = (await vt.computePacketStats(120)).averagePacketRate;
    } catch {
      frameRate = undefined;
    }
    return {
      width: vt.displayWidth,
      height: vt.displayHeight,
      durationSeconds,
      rotation: vt.rotation,
      hasAudio: !!at,
      frameRate,
      audioChannels: at?.numberOfChannels,
      audioSampleRate: at?.sampleRate,
      videoCodec: vt.codec,
      audioCodec: at?.codec ?? null,
      demuxable: true,
    };
  } catch (e) {
    if (e instanceof VideoProcessingError) throw e;
    return null;
  } finally {
    input.dispose();
  }
}

function probeWithElement(file: File): Promise<VideoProbe | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (r: VideoProbe | null) => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(r);
    };
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) return done(null);
      done({ width: video.videoWidth, height: video.videoHeight, durationSeconds: Number.isFinite(video.duration) ? video.duration : 0, rotation: 0, hasAudio: true, demuxable: false });
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}
