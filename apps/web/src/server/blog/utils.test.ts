import { describe, expect, it } from "vitest";
import { blogSlugify, deletedSlug, excerpt, normalizeTags, readingMinutes, shouldCreateRedirect, spDayKey, spDayStart, tagsFromString, tagsToString, uniqueSlug } from "./utils";

describe("slugs", () => {
  it("slugifies pt-BR titles", () => {
    expect(blogSlugify("Vacinação de filhotes: o que você precisa saber!")).toBe("vacinacao-de-filhotes-o-que-voce-precisa-saber");
    expect(blogSlugify("  --Cães & Gatos--  ")).toBe("caes-gatos");
  });
  it("cuts long slugs on a dash", () => {
    const s = blogSlugify("palavra ".repeat(40));
    expect(s.length).toBeLessThanOrEqual(120);
    expect(s.endsWith("-")).toBe(false);
  });
  it("finds the first free slug", async () => {
    const taken = new Set(["post", "post-2"]);
    expect(await uniqueSlug("post", async (x) => taken.has(x))).toBe("post-3");
    expect(await uniqueSlug("novo", async (x) => taken.has(x))).toBe("novo");
    expect(await uniqueSlug("", async () => false)).toBe("post");
  });
  it("releases the slug of a deleted post", () => {
    expect(deletedSlug("meu-post", "cmum8ay9q004vehxl3tkee0tk")).toBe("meu-post--deleted-xl3tkee0tk");
    const long = deletedSlug("a".repeat(200), "cmum8ay9q004vehxl3tkee0tk");
    expect(long.length).toBe(200);
    expect(long.endsWith("--deleted-xl3tkee0tk")).toBe(true);
  });
  it("creates a redirect only when a published post changes slug", () => {
    expect(shouldCreateRedirect({ oldSlug: "a", newSlug: "b", previousStatus: "PUBLISHED" })).toBe(true);
    expect(shouldCreateRedirect({ oldSlug: "a", newSlug: "a", previousStatus: "PUBLISHED" })).toBe(false);
    expect(shouldCreateRedirect({ oldSlug: "a", newSlug: "b", previousStatus: "DRAFT" })).toBe(false);
    expect(shouldCreateRedirect({ oldSlug: "a", newSlug: "b", previousStatus: "SCHEDULED" })).toBe(false);
  });
});

describe("reading time", () => {
  it("is ceil(words/200), min 1", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes(`<p>${"palavra ".repeat(200)}</p>`)).toBe(1);
    expect(readingMinutes(`<p>${"palavra ".repeat(201)}</p>`)).toBe(2);
    expect(readingMinutes(`<h2>a</h2><p>${"x ".repeat(399)}</p><script>${"y ".repeat(1000)}</script>`)).toBe(2);
  });
  it("builds excerpts", () => {
    expect(excerpt("<p>Olá <b>mundo</b></p>")).toBe("Olá mundo");
    expect(excerpt(`<p>${"abc ".repeat(100)}</p>`, 50).endsWith("…")).toBe(true);
  });
});

describe("tags", () => {
  it("normalizes and round-trips", () => {
    const t = normalizeTags([" Saúde ", "saúde", "a,b", "", "Nutrição   canina"]);
    expect(t).toEqual(["Saúde", "a b", "Nutrição canina"]);
    expect(tagsFromString(tagsToString(t))).toEqual(t);
    expect(tagsToString([])).toBeNull();
  });
});

describe("São Paulo days", () => {
  it("maps instants to SP calendar days", () => {
    expect(spDayKey(new Date("2026-09-29T02:30:00Z"))).toBe("2026-09-28");
    expect(spDayKey(new Date("2026-09-29T03:00:00Z"))).toBe("2026-09-29");
    expect(spDayStart("2026-09-29").toISOString()).toBe("2026-09-29T03:00:00.000Z");
  });
});
