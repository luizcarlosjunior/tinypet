import { describe, expect, it } from "vitest";
import { clampQuality, CROP_PRESETS, cropOutputSize, fitWithin, formatBytes, maxAspectRect, replaceExtension, toNaturalCrop, validateImageFile } from "./blog-media";

describe("clampQuality", () => {
  it("clamps to 1..100 and rounds", () => {
    expect(clampQuality(0)).toBe(1);
    expect(clampQuality(-20)).toBe(1);
    expect(clampQuality(150)).toBe(100);
    expect(clampQuality(84.6)).toBe(85);
    expect(clampQuality("70")).toBe(70);
  });
  it("falls back to 85 for invalid input", () => {
    expect(clampQuality(NaN)).toBe(85);
    expect(clampQuality(undefined)).toBe(85);
    expect(clampQuality("abc")).toBe(85);
  });
});

describe("fitWithin (resize bounds)", () => {
  it("keeps small images untouched (no upscale)", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });
  it("bounds the longest side to 1920 keeping the aspect ratio", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1920, height: 1440 });
    expect(fitWithin(3000, 6000)).toEqual({ width: 960, height: 1920 });
    expect(fitWithin(5000, 5000)).toEqual({ width: 1920, height: 1920 });
  });
  it("supports a custom max and never returns 0", () => {
    expect(fitWithin(10000, 10, 1000)).toEqual({ width: 1000, height: 1 });
    expect(fitWithin(0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe("crop target dimensions", () => {
  it("presets force exact output sizes", () => {
    expect(cropOutputSize({ width: 640, height: 360 }, CROP_PRESETS.rect)).toEqual({ width: 1920, height: 1080 });
    expect(cropOutputSize({ width: 3000, height: 3000 }, CROP_PRESETS.square)).toEqual({ width: 1080, height: 1080 });
    expect(cropOutputSize({ width: 2400, height: 1260 }, CROP_PRESETS.og)).toEqual({ width: 1200, height: 630 });
  });
  it("preset aspects match their sizes and OG is PNG", () => {
    for (const p of Object.values(CROP_PRESETS)) expect(p.width / p.height).toBeCloseTo(p.aspect, 5);
    expect(CROP_PRESETS.og.format).toBe("png");
    expect(CROP_PRESETS.rect.format).toBe("webp");
  });
  it("free crops are bounded by 1920", () => {
    expect(cropOutputSize({ width: 4000, height: 1000 })).toEqual({ width: 1920, height: 480 });
  });
  it("converts rendered crop to natural pixels and clamps", () => {
    expect(toNaturalCrop({ x: 10, y: 20, width: 160, height: 90 }, { width: 400, height: 300 }, { width: 4000, height: 3000 })).toEqual({ x: 100, y: 200, width: 1600, height: 900 });
    const c = toNaturalCrop({ x: 350, y: 250, width: 100, height: 100 }, { width: 400, height: 300 }, { width: 400, height: 300 });
    expect(c.x + c.width).toBeLessThanOrEqual(400);
    expect(c.y + c.height).toBeLessThanOrEqual(300);
  });
  it("maxAspectRect is centered and fits", () => {
    expect(maxAspectRect({ width: 1000, height: 1000 }, 16 / 9)).toEqual({ x: 0, y: 218.75, width: 1000, height: 562.5 });
    expect(maxAspectRect({ width: 2000, height: 500 }, 1)).toEqual({ x: 750, y: 0, width: 500, height: 500 });
  });
});

describe("file helpers", () => {
  it("rejects SVG and oversized files", () => {
    expect(validateImageFile({ type: "image/svg+xml", size: 10, name: "a.svg" })).toMatch(/SVG/);
    expect(validateImageFile({ type: "", size: 10, name: "x.svg" })).toMatch(/SVG/);
    expect(validateImageFile({ type: "image/png", size: 11 * 1024 * 1024, name: "a.png" })).toMatch(/maior/);
    expect(validateImageFile({ type: "application/pdf", size: 10, name: "a.pdf" })).toMatch(/Formato/);
    expect(validateImageFile({ type: "image/webp", size: 1000, name: "a.webp" })).toBeNull();
  });
  it("formats bytes and replaces extensions", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1048576)).toBe("3.00 MB");
    expect(replaceExtension("foto.final.JPG", "webp")).toBe("foto.final.webp");
    expect(replaceExtension("semext", "png")).toBe("semext.png");
  });
});
