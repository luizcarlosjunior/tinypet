import { describe, expect, it } from "vitest";
import { safeHref, bytesMatchMime, extensionForMime, withHttps, updatePartnerSchema, httpUrl } from "@tinypet/shared";
import { safeNext } from "./safe-next";

describe("safeHref", () => {
  it("accepts http(s)", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHref("http://example.com")).toBe("http://example.com");
    expect(safeHref("  https://example.com  ")).toBe("https://example.com");
  });
  it("rejects dangerous or malformed values", () => {
    for (const v of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "java\tscript:alert(1)", "data:text/html,<script>1</script>", "vbscript:x", "/relative", "//evil.com", "", null, undefined, "https://exa mple.com"]) {
      expect(safeHref(v as string | null | undefined)).toBeUndefined();
    }
  });
  it("mailto/tel only when allowed", () => {
    expect(safeHref("mailto:a@b.com")).toBeUndefined();
    expect(safeHref("mailto:a@b.com", { allowMailto: true })).toBe("mailto:a@b.com");
    expect(safeHref("tel:+5511999999999")).toBeUndefined();
    expect(safeHref("tel:+5511999999999", { allowTel: true })).toBe("tel:+5511999999999");
  });
});

describe("safeNext", () => {
  it("keeps same-origin paths", () => {
    expect(safeNext("/pets/123?tab=saude#x")).toBe("/pets/123?tab=saude#x");
    expect(safeNext("/convite/abc")).toBe("/convite/abc");
  });
  it("rejects open redirects", () => {
    for (const v of ["/\\evil.com", "\\\\evil.com", "//evil.com", "https://evil.com", "javascript:alert(1)", "/\t/evil.com", "/ /evil.com", "/%0a", "evil.com", "", null, undefined]) {
      expect(safeNext(v as string | null | undefined, "/fallback")).toBe(v === "/%0a" ? "/%0a" : "/fallback");
    }
  });
  it("uses the default fallback", () => {
    expect(safeNext("/\\evil.com")).toBe("/inicio");
  });
});

const hex = (h: string) => Uint8Array.from(h.replace(/\s+/g, "").match(/../g)!.map((x) => parseInt(x, 16)));
const ftyp = (major: string, ...compat: string[]) => {
  const brands = [major, "\0\0\0\0", ...compat].join("");
  const size = 8 + brands.length;
  const b = new Uint8Array(size);
  b.set([0, 0, 0, size], 0);
  b.set(new TextEncoder().encode("ftyp" + brands), 4);
  return b;
};

describe("bytesMatchMime", () => {
  const PNG = hex("89504E470D0A1A0A0000000D49484452");
  const JPEG = hex("FFD8FFE000104A464946");
  const WEBP = new TextEncoder().encode("RIFF\x10\x00\x00\x00WEBPVP8 ");
  const PDF = new TextEncoder().encode("%PDF-1.7\n");
  const HTML = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
  it("accepts real signatures", () => {
    expect(bytesMatchMime(PNG, "image/png")).toBe(true);
    expect(bytesMatchMime(JPEG, "image/jpeg")).toBe(true);
    expect(bytesMatchMime(WEBP, "image/webp")).toBe(true);
    expect(bytesMatchMime(PDF, "application/pdf")).toBe(true);
    expect(bytesMatchMime(ftyp("heic", "mif1", "heic"), "image/heic")).toBe(true);
    expect(bytesMatchMime(ftyp("mif1", "heic"), "image/heif")).toBe(true);
    expect(bytesMatchMime(ftyp("isom", "iso2", "avc1", "mp41"), "video/mp4")).toBe(true);
    expect(bytesMatchMime(ftyp("qt  ", "qt  "), "video/quicktime")).toBe(true);
  });
  it("rejects mismatches and disguised files", () => {
    expect(bytesMatchMime(HTML, "application/pdf")).toBe(false);
    expect(bytesMatchMime(HTML, "image/png")).toBe(false);
    expect(bytesMatchMime(PNG, "image/jpeg")).toBe(false);
    expect(bytesMatchMime(JPEG, "image/png")).toBe(false);
    expect(bytesMatchMime(ftyp("heic", "mif1"), "video/mp4")).toBe(false);
    expect(bytesMatchMime(ftyp("qt  ", "isom"), "video/mp4")).toBe(false);
    expect(bytesMatchMime(ftyp("isom", "mp41"), "image/heic")).toBe(false);
    expect(bytesMatchMime(PNG, "image/svg+xml")).toBe(false);
    expect(bytesMatchMime(new Uint8Array(), "image/png")).toBe(false);
  });
  it("extension only from the MIME allowlist", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("video/mp4")).toBe("mp4");
    expect(extensionForMime("video/quicktime")).toBeNull(); // MOV is source-only; uploads are transcoded MP4
    expect(extensionForMime("text/html")).toBeNull();
    expect(extensionForMime("__proto__")).toBeNull();
  });
});

describe("URL schemas", () => {
  it("httpUrl blocks non-http schemes", () => {
    expect(httpUrl.safeParse("https://ok.com").success).toBe(true);
    expect(httpUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(httpUrl.safeParse("data:text/html,x").success).toBe(false);
  });
  it("partner website and social links must be http(s)", () => {
    expect(updatePartnerSchema.safeParse({ website: "javascript:alert(1)" }).success).toBe(false);
    expect(updatePartnerSchema.safeParse({ socialLinks: [{ network: "INSTAGRAM", url: "javascript:alert(1)" }] }).success).toBe(false);
    expect(updatePartnerSchema.safeParse({ website: "", socialLinks: [{ network: "INSTAGRAM", url: "https://instagram.com/x" }] }).success).toBe(true);
  });
  it("withHttps prefixes bare domains", () => {
    expect(withHttps("instagram.com/x")).toBe("https://instagram.com/x");
    expect(withHttps("https://a.com")).toBe("https://a.com");
    expect(withHttps("javascript:alert(1)")).toBe("javascript:alert(1)");
    expect(withHttps("  ")).toBe("");
  });
});
