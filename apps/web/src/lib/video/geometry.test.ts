import { describe, expect, it } from "vitest";
import { videoOutputSize } from "@tinypet/shared";
import { centerCropRect, clampOffset, coverScale, fitWithin, matchesAspect, viewportCropRect, viewportSize } from "./geometry";

describe("videoOutputSize (shared contract)", () => {
  it("picks 1080p when the short side is >= 1080", () => {
    expect(videoOutputSize(1920, 1080)).toMatchObject({ width: 1920, height: 1080, label: "1080p", orientation: "landscape" });
    expect(videoOutputSize(3840, 2160)).toMatchObject({ width: 1920, height: 1080 });
    expect(videoOutputSize(1080, 1920)).toMatchObject({ width: 1080, height: 1920, orientation: "portrait" });
    expect(videoOutputSize(1440, 1440)).toMatchObject({ width: 1920, height: 1080, orientation: "landscape" });
  });
  it("picks 720p otherwise (upscaling small sources)", () => {
    expect(videoOutputSize(1280, 720)).toMatchObject({ width: 1280, height: 720, label: "720p" });
    expect(videoOutputSize(640, 480)).toMatchObject({ width: 1280, height: 720 });
    expect(videoOutputSize(720, 1280)).toMatchObject({ width: 720, height: 1280, orientation: "portrait" });
    expect(videoOutputSize(1920, 1000)).toMatchObject({ label: "720p" });
  });
});

describe("centerCropRect", () => {
  it("keeps a frame that already has the aspect", () => {
    expect(centerCropRect(1920, 1080, 16 / 9)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
  it("crops the sides of a 4:3 source to 16:9", () => {
    expect(centerCropRect(1440, 1080, 16 / 9)).toEqual({ x: 0, y: 135, width: 1440, height: 810 });
  });
  it("crops the sides of a wide source to 9:16", () => {
    const r = centerCropRect(1920, 1080, 9 / 16);
    expect(r.height).toBe(1080);
    expect(r.width).toBe(608);
    expect(r.x).toBe(656);
  });
  it("crops top/bottom of a tall portrait source", () => {
    const r = centerCropRect(1080, 2400, 9 / 16);
    expect(r).toEqual({ x: 0, y: 240, width: 1080, height: 1920 });
  });
  it("rejects invalid input", () => {
    expect(() => centerCropRect(0, 10, 1)).toThrow();
  });
});

describe("cropper viewport math", () => {
  it("builds viewports for landscape, portrait and square", () => {
    expect(viewportSize(320, 16 / 9)).toEqual({ width: 320, height: 180 });
    expect(viewportSize(320, 9 / 16)).toEqual({ width: 180, height: 320 });
    expect(viewportSize(280, 1)).toEqual({ width: 280, height: 280 });
  });

  it("returns the centered 16:9 crop at zoom 1 for a 4000×3000 photo", () => {
    const view = viewportSize(320, 16 / 9);
    const scale = coverScale(4000, 3000, view.width, view.height);
    const r = viewportCropRect({ imgW: 4000, imgH: 3000, viewW: view.width, viewH: view.height, scale, offset: { x: 0, y: 0 }, aspect: 16 / 9 });
    expect(r.width).toBe(4000);
    expect(r.height).toBe(2250);
    expect(r.x).toBe(0);
    expect(r.y).toBe(375);
    expect(matchesAspect(r.width, r.height, 16 / 9)).toBe(true);
  });

  it("follows pan and zoom and stays in bounds", () => {
    const view = viewportSize(320, 9 / 16);
    const base = coverScale(1920, 1080, view.width, view.height);
    const scale = base * 2;
    const off = clampOffset({ x: 10_000, y: 0 }, 1920, 1080, view.width, view.height, scale);
    const r = viewportCropRect({ imgW: 1920, imgH: 1080, viewW: view.width, viewH: view.height, scale, offset: off, aspect: 9 / 16 });
    expect(r.x).toBe(0); // panned fully to the left edge
    expect(r.y + r.height).toBeLessThanOrEqual(1080);
    expect(matchesAspect(r.width, r.height, 9 / 16)).toBe(true);
    expect(r.height).toBe(540);
  });

  it("keeps square crops square (existing callers)", () => {
    const scale = coverScale(1200, 800, 280, 280) * 1.37;
    const r = viewportCropRect({ imgW: 1200, imgH: 800, viewW: 280, viewH: 280, scale, offset: { x: -13, y: 7 }, aspect: 1 });
    expect(r.width).toBe(r.height);
    expect(r.x + r.width).toBeLessThanOrEqual(1200);
    expect(r.y + r.height).toBeLessThanOrEqual(800);
  });

  it("fits cover output within VIDEO_COVER_MAX_PX", () => {
    expect(fitWithin(1920, 1080, 1280)).toEqual({ width: 1280, height: 720 });
    expect(fitWithin(1080, 1920, 1280)).toEqual({ width: 720, height: 1280 });
    expect(fitWithin(640, 360, 1280)).toEqual({ width: 640, height: 360 });
  });
});
