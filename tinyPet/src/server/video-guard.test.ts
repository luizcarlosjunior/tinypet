import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertSaneMp4Tables, validateMp4 } from "./video-validate";

const fixture = () => new Uint8Array(readFileSync(join(__dirname, "__fixtures__", "valid-720p.mp4")));
const boxAt = (b: Uint8Array, tag: string) => Buffer.from(b).indexOf(tag) - 4;

describe("MP4 sample-table guard (crash protection)", () => {
  it("accepts a real client-transcoded MP4", () => {
    expect(() => assertSaneMp4Tables(fixture())).not.toThrow();
  });
  it("rejects a tiny file that declares billions of samples (heap-OOM payload) before parsing", async () => {
    const b = fixture();
    const v = new DataView(b.buffer);
    const stts = boxAt(b, "stts");
    v.setUint32(stts + 16, 0xffffffff); // first stts entry sample_count
    const stsz = boxAt(b, "stsz");
    v.setUint32(stsz + 12, 100); // constant sample size
    v.setUint32(stsz + 16, 0xffffffff); // sample_count
    const t = Date.now();
    await expect(validateMp4(b, { width: 1280, height: 720 })).rejects.toMatchObject({ reason: "VIDEO_INVALID" });
    expect(Date.now() - t).toBeLessThan(1000);
  });
  it("rejects a constant-size stsz claiming more bytes than the file", () => {
    const b = fixture();
    const v = new DataView(b.buffer);
    const stsz = boxAt(b, "stsz");
    v.setUint32(stsz + 12, 5_000_000);
    v.setUint32(stsz + 16, 100);
    expect(() => assertSaneMp4Tables(b)).toThrow();
  });
});
