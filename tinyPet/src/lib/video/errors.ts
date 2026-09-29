export type VideoErrorCode = "CANCELED" | "NO_VIDEO" | "UNREADABLE" | "UNSUPPORTED" | "TOO_BIG" | "INVALID_OUTPUT" | "ENGINE" | "SOURCE_TOO_LARGE" | "PLAN_QUOTA" | "PLAN_DURATION";

/** Error raised by the client-side video pipeline; `message` is pt-BR and user-facing. */
export class VideoProcessingError extends Error {
  constructor(public code: VideoErrorCode, message: string, public cause?: unknown) {
    super(message);
    this.name = "VideoProcessingError";
  }
}

export const canceled = () => new VideoProcessingError("CANCELED", "Conversão cancelada.");

export function throwIfAborted(signal?: AbortSignal | null) {
  if (signal?.aborted) throw canceled();
}

export function isCanceled(e: unknown): boolean {
  return (e instanceof VideoProcessingError && e.code === "CANCELED") || (e instanceof DOMException && e.name === "AbortError");
}
