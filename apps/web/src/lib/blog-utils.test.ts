import { describe, expect, it } from "vitest";
import { blogSlugify, fromSpInputValue, isSafeLinkUrl, normalizeLinkUrl, normalizeTags, readingMinutes, sanitizeSlugInput, toSpInputValue, truncate, youtubeId } from "./blog-utils";

describe("blogSlugify", () => {
  it("removes accents and symbols", () => {
    expect(blogSlugify("Vacinação de Cães & Gatos: guia 2026!")).toBe("vacinacao-de-caes-e-gatos-guia-2026");
    expect(blogSlugify("  --Olá  mundo--  ")).toBe("ola-mundo");
    expect(blogSlugify("")).toBe("");
  });
  it("limits length without a trailing dash", () => {
    const s = blogSlugify("a".repeat(50) + " " + "b".repeat(100));
    expect(s.length).toBeLessThanOrEqual(120);
    expect(s.endsWith("-")).toBe(false);
    expect(blogSlugify("abc def", 4)).toBe("abc");
  });
  it("sanitizes typed slugs", () => {
    expect(sanitizeSlugInput("Meu Slug É")).toBe("meu-slug-e");
    expect(sanitizeSlugInput("abc-")).toBe("abc-");
    expect(sanitizeSlugInput("--a//b")).toBe("a-b");
  });
});

describe("misc", () => {
  it("reading time", () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(201)).toBe(2);
  });
  it("São Paulo datetime round-trip", () => {
    expect(toSpInputValue("2026-10-01T15:30:00.000Z")).toBe("2026-10-01T12:30");
    expect(fromSpInputValue("2026-10-01T12:30")).toBe("2026-10-01T15:30:00.000Z");
    expect(fromSpInputValue("")).toBeNull();
  });
  it("links: only http/https/mailto", () => {
    expect(isSafeLinkUrl("https://tinypet.com.br")).toBe(true);
    expect(isSafeLinkUrl("mailto:a@b.co")).toBe(true);
    expect(isSafeLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeLinkUrl("data:text/html,x")).toBe(false);
    expect(normalizeLinkUrl("tinypet.com.br/x")).toBe("https://tinypet.com.br/x");
    expect(normalizeLinkUrl("a@b.co")).toBe("mailto:a@b.co");
  });
  it("youtube ids", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://vimeo.com/1")).toBeNull();
  });
  it("tags and truncate", () => {
    expect(normalizeTags(" Cães, gatos ,cães,, ")).toEqual(["cães", "gatos"]);
    expect(normalizeTags(["A", "a", "B"])).toEqual(["a", "b"]);
    expect(truncate("abcdef", 4)).toBe("abc…");
  });
});
