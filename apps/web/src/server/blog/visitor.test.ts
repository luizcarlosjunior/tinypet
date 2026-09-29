import { describe, expect, it } from "vitest";
import { isBotUserAgent, isSameOriginRequest, parseUa, referrerHost, viewSource, visitorHash } from "./visitor";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe("visitorHash", () => {
  it("is stable for the same inputs and changes with day/ip/ua/salt", () => {
    const a = visitorHash("1.2.3.4", CHROME, "2026-09-29", "s");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(visitorHash("1.2.3.4", CHROME, "2026-09-29", "s")).toBe(a);
    expect(visitorHash("1.2.3.4", CHROME, "2026-09-30", "s")).not.toBe(a);
    expect(visitorHash("1.2.3.5", CHROME, "2026-09-29", "s")).not.toBe(a);
    expect(visitorHash("1.2.3.4", IPHONE, "2026-09-29", "s")).not.toBe(a);
    expect(visitorHash("1.2.3.4", CHROME, "2026-09-29", "t")).not.toBe(a);
    expect(a).not.toContain("1.2.3.4");
  });
});

describe("bots", () => {
  it("filters crawlers and tools", () => {
    for (const ua of ["Googlebot/2.1 (+http://www.google.com/bot.html)", "curl/8.4.0", "Wget/1.21", "Mozilla/5.0 HeadlessChrome/120", "WhatsApp link preview", "", "x"]) expect(isBotUserAgent(ua)).toBe(true);
    expect(isBotUserAgent(CHROME)).toBe(false);
    expect(isBotUserAgent(IPHONE)).toBe(false);
  });
});

describe("same origin", () => {
  const app = "https://tinypet.test";
  it("uses Origin, then Referer", () => {
    expect(isSameOriginRequest(h({ origin: "https://tinypet.test" }), app)).toBe(true);
    expect(isSameOriginRequest(h({ origin: "https://evil.test", referer: "https://tinypet.test/blog/a" }), app)).toBe(false);
    expect(isSameOriginRequest(h({ referer: "https://tinypet.test/blog/a" }), app)).toBe(true);
    expect(isSameOriginRequest(h({ referer: "https://tinypet.test.evil.test/" }), app)).toBe(false);
    expect(isSameOriginRequest(h({}), app)).toBe(false);
  });
  it("referrer host ignores our own host", () => {
    expect(referrerHost("https://www.google.com/search?q=x", "https://tinypet.test")).toBe("google.com");
    expect(referrerHost("https://tinypet.test/blog", "https://tinypet.test")).toBeNull();
    expect(referrerHost("", "https://tinypet.test")).toBeNull();
  });
});

describe("parseUa", () => {
  it("detects device/browser/os", () => {
    expect(parseUa(CHROME)).toEqual({ device: "desktop", browser: "Chrome", os: "Mac OS" });
    expect(parseUa(IPHONE).device).toBe("mobile");
  });
});

describe("viewSource", () => {
  it("accepts same-origin browsers and token-authenticated apps without Origin", () => {
    expect(viewSource({ sameOrigin: true, hasOrigin: true, validBearer: false })).toBe("web");
    expect(viewSource({ sameOrigin: true, hasOrigin: false, validBearer: false })).toBe("web");
    expect(viewSource({ sameOrigin: false, hasOrigin: false, validBearer: true })).toBe("app");
  });
  it("rejects anonymous cross-site calls, invalid tokens and foreign origins even with a token", () => {
    expect(viewSource({ sameOrigin: false, hasOrigin: false, validBearer: false })).toBe("reject");
    expect(viewSource({ sameOrigin: false, hasOrigin: true, validBearer: true })).toBe("reject");
    expect(viewSource({ sameOrigin: false, hasOrigin: true, validBearer: false })).toBe("reject");
  });
});
