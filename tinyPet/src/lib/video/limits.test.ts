import { describe, expect, it } from "vitest";
import { MEDIA_MAX_BYTES } from "@tinypet/shared";
import { averageBitrate, cappedFrameRate, checkOutput, defaultCoverTime, trimWindow, estimateOutputBytes, ffmpegArgs, formatVideoInfo, maxDurationSeconds, MSG_TOO_BIG, parseFfmpegProbe, pickChannels, pickSampleRate, rotatedSize } from "./limits";

describe("bitrate / size checks", () => {
  it("computes the average bitrate", () => {
    expect(averageBitrate(1_000_000, 8)).toBe(1_000_000);
    expect(averageBitrate(1, 0)).toBe(Infinity);
  });

  it("accepts a compliant 720p file", () => {
    const sizeBytes = Math.round((40 * 1_050_000) / 8);
    expect(checkOutput({ width: 1280, height: 720, sizeBytes, durationSeconds: 40, hasAudio: true, videoBitrate: 930_000, audioBitrate: 127_000 })).toEqual({ ok: true });
  });

  it("rejects frames that are not allowed", () => {
    expect(checkOutput({ width: 1280, height: 721, sizeBytes: 1000, durationSeconds: 1, hasAudio: false })).toMatchObject({ ok: false, reason: "FRAME" });
  });

  it("rejects files above 10 MB with the pt-BR message", () => {
    const r = checkOutput({ width: 1920, height: 1080, sizeBytes: MEDIA_MAX_BYTES + 1, durationSeconds: 90, hasAudio: true });
    expect(r).toEqual({ ok: false, reason: "TOO_BIG", message: MSG_TOO_BIG });
  });

  it("rejects per-track and total bitrate overshoots", () => {
    expect(checkOutput({ width: 1280, height: 720, sizeBytes: 100_000, durationSeconds: 10, hasAudio: true, videoBitrate: 1_200_000 })).toMatchObject({ reason: "VIDEO_BITRATE" });
    expect(checkOutput({ width: 1280, height: 720, sizeBytes: 100_000, durationSeconds: 10, hasAudio: true, audioBitrate: 192_000 })).toMatchObject({ reason: "AUDIO_BITRATE" });
    // 10 s at 1.5 Mbps total, no audio
    expect(checkOutput({ width: 1280, height: 720, sizeBytes: 1_875_000, durationSeconds: 10, hasAudio: false })).toMatchObject({ reason: "TOTAL_BITRATE" });
  });

  it("estimates the max duration around 70–80 s", () => {
    expect(maxDurationSeconds(true)).toBeGreaterThanOrEqual(70);
    expect(maxDurationSeconds(true)).toBeLessThan(80);
    expect(estimateOutputBytes(maxDurationSeconds(true), true)).toBeLessThanOrEqual(MEDIA_MAX_BYTES);
    expect(estimateOutputBytes(maxDurationSeconds(true) + 2, true)).toBeGreaterThan(MEDIA_MAX_BYTES);
  });
});

describe("audio / frame-rate choices", () => {
  it("keeps 44.1/48 kHz and caps channels at stereo", () => {
    expect(pickSampleRate(44100)).toBe(44100);
    expect(pickSampleRate(48000)).toBe(48000);
    expect(pickSampleRate(22050)).toBe(48000);
    expect(pickChannels(1)).toBe(1);
    expect(pickChannels(6)).toBe(2);
  });
  it("caps the frame rate at 30 fps only when faster", () => {
    expect(cappedFrameRate(59.94)).toBe(30);
    expect(cappedFrameRate(30)).toBeUndefined();
    expect(cappedFrameRate(24)).toBeUndefined();
    expect(cappedFrameRate(null)).toBeUndefined();
  });
});

describe("ffmpeg fallback helpers", () => {
  it("builds the transcode args", () => {
    const a = ffmpegArgs("/in/source.mov", "out.mp4", { width: 720, height: 1280 });
    expect(a).toContain("scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1");
    expect(a.join(" ")).toContain("-c:v libx264");
    expect(a.join(" ")).toContain("-b:v 950k -maxrate 1000k -bufsize 2000k");
    expect(a.join(" ")).toContain("-b:a 128k");
    expect(a.join(" ")).toContain("-movflags +faststart");
    expect(a.at(-1)).toBe("out.mp4");
  });
  it("adds -ss/-t when trimming", () => {
    const a = ffmpegArgs("/in/s.mp4", "out.mp4", { width: 1280, height: 720 }, { start: 5, end: 35 }).join(" ");
    expect(a.startsWith("-ss 5.000 -i /in/s.mp4 -t 30.000")).toBe(true);
    expect(ffmpegArgs("/in/s.mp4", "out.mp4", { width: 1280, height: 720 }, { start: 0, end: 30 }).join(" ").startsWith("-i /in/s.mp4 -t 30.000")).toBe(true);
  });
  it("parses probe logs (with rotation)", () => {
    const log = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '/in/source.mov':
  Duration: 00:01:02.50, start: 0.000000, bitrate: 8000 kb/s
  Stream #0:0[0x1](und): Video: hevc (Main) (hvc1 / 0x31637668), yuv420p(tv), 1920x1080, 7800 kb/s, 29.97 fps
    Side data:
      displaymatrix: rotation of -90.00 degrees`;
    const p = parseFfmpegProbe(log);
    expect(p).toEqual({ durationSeconds: 62.5, width: 1920, height: 1080, rotation: 270 });
    expect(rotatedSize(1920, 1080, p.rotation)).toEqual({ width: 1080, height: 1920 });
  });
  it("formats the output info line", () => {
    expect(formatVideoInfo({ width: 1280, height: 720, label: "720p", durationSeconds: 42.2, sizeBytes: 5.1 * 1024 * 1024 })).toBe("1280×720 · 720p · 42 s · 5,1 MB");
  });
});

describe("plan duration trimming", () => {
  it("returns null when the source fits", () => {
    expect(trimWindow(25, 30)).toBeNull();
    expect(trimWindow(30, 30)).toBeNull();
    expect(trimWindow(90, null)).toBeNull();
  });
  it("uses the first N seconds by default and clamps the start offset", () => {
    // Cuts stay TRIM_MARGIN_SECONDS (0.25 s) under the limit so the encoded file never exceeds it.
    expect(trimWindow(95, 30)).toEqual({ start: 0, end: 29.75 });
    expect(trimWindow(95, 60, 20)).toEqual({ start: 20, end: 79.75 });
    expect(trimWindow(95, 60, 80)).toEqual({ start: 35.25, end: 95 });
  });
  it("picks the default cover time", () => {
    expect(defaultCoverTime(42)).toBe(1);
    expect(defaultCoverTime(1)).toBe(0.5);
    expect(defaultCoverTime(0)).toBe(0);
  });
});

describe("video plan limit messages", () => {
  it("maps the per-day and max-seconds feature keys", async () => {
    const { videoPlanLimitMessage } = await import("./limits");
    expect(videoPlanLimitMessage({ featureKey: "owner_videos_per_day", limit: 1, current: 1 })).toBe("Seu plano permite 1 vídeo por dia e você já enviou 1 hoje.");
    expect(videoPlanLimitMessage({ featureKey: "videos_per_day", limit: 10 })).toBe("Seu plano permite 10 vídeos por dia.");
    expect(videoPlanLimitMessage({ featureKey: "video_max_seconds", limit: 30 })).toBe("Seu plano permite vídeos de até 30 segundos.");
    expect(videoPlanLimitMessage({ featureKey: "catalog_items", limit: 3 })).toBeNull();
  });
});
