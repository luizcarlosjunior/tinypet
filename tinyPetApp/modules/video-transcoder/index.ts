// JS binding for the local Expo module `VideoTranscoder` (Swift: ios/VideoTranscoderModule.swift,
// Kotlin: android/.../VideoTranscoderModule.kt). Autolinked from `tinyPetApp/modules/` — requires a
// development build / EAS build; it is NOT available in Expo Go (loaded optionally so the JS bundle still runs).
import { requireOptionalNativeModule } from "expo";

type EventSubscription = { remove(): void };

export type VideoProbe = {
  /** Display size (rotation already applied). */
  width: number;
  height: number;
  rotation: number;
  durationSeconds: number;
  frameRate: number;
  /** MP4 sample entry, e.g. "avc1" / "hvc1" (Android may report a MIME type for other codecs). */
  videoCodec: string;
  /** Average bitrate in bits/s (exact sample walk for transcoded output on Android; estimatedDataRate on iOS). */
  videoBitrate: number;
  hasAudio: boolean;
  audioCodec: string | null;
  audioBitrate: number;
  sizeBytes: number;
};

export type TranscodeResult = VideoProbe & { uri: string };

export type NativeTranscodeOptions = {
  jobId: string;
  uri: string;
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  maxFrameRate: number;
  keyFrameIntervalSeconds: number;
  /** 0 = whole video; otherwise transcode only the first N seconds. */
  maxDurationSeconds: number;
};

type ProgressEvent = { jobId: string; progress: number };

type VideoTranscoderNative = {
  probe(uri: string): Promise<VideoProbe>;
  transcode(options: NativeTranscodeOptions): Promise<TranscodeResult>;
  cancel(jobId: string): Promise<void>;
  addListener(event: "onProgress", listener: (e: ProgressEvent) => void): EventSubscription;
};

const Native = requireOptionalNativeModule<VideoTranscoderNative>("VideoTranscoder");

export function isVideoTranscoderAvailable(): boolean {
  return !!Native;
}

function native(): VideoTranscoderNative {
  if (!Native) {
    throw new Error("O processamento de vídeo não está disponível nesta versão do app. Atualize o aplicativo (módulo nativo VideoTranscoder ausente — use um development build, não o Expo Go).");
  }
  return Native;
}

export const VideoTranscoder = {
  probe: (uri: string) => native().probe(uri),
  transcode: (options: NativeTranscodeOptions) => native().transcode(options),
  cancel: (jobId: string) => native().cancel(jobId),
  onProgress(jobId: string, cb: (progress: number) => void): EventSubscription {
    return native().addListener("onProgress", (e) => {
      if (e.jobId === jobId) cb(e.progress);
    });
  },
};
