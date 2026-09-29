import { describe, it, expect } from "vitest";
import { spDayStartUtc, countsTowardVideoQuota, videoQuotaWhere, durationLimitError, perDayLimitError, videoOwnerOf, STALE_PENDING_MS } from "./video-limits";

describe("spDayStartUtc (America/Sao_Paulo, UTC−3)", () => {
  it("is 03:00 UTC of the SP calendar day", () => {
    expect(spDayStartUtc(new Date("2026-09-28T15:00:00Z")).toISOString()).toBe("2026-09-28T03:00:00.000Z");
  });
  it("before 03:00 UTC it is still the previous SP day", () => {
    expect(spDayStartUtc(new Date("2026-09-29T02:59:59Z")).toISOString()).toBe("2026-09-28T03:00:00.000Z");
    expect(spDayStartUtc(new Date("2026-09-29T03:00:00Z")).toISOString()).toBe("2026-09-29T03:00:00.000Z");
  });
  it("SP midnight exactly starts a new day", () => {
    expect(spDayStartUtc(new Date("2026-01-01T00:00:00-03:00")).toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });
});

describe("countsTowardVideoQuota", () => {
  const now = new Date("2026-09-28T23:30:00-03:00");
  const v = (status: string, createdAt: string, kind = "VIDEO") => countsTowardVideoQuota({ kind, status, createdAt: new Date(createdAt) }, now);
  it("counts READY / FLAGGED videos created today (SP)", () => {
    expect(v("READY", "2026-09-28T00:00:00-03:00")).toBe(true);
    expect(v("FLAGGED", "2026-09-28T12:00:00-03:00")).toBe(true);
  });
  it("ignores yesterday (SP), rejected and non-video assets", () => {
    expect(v("READY", "2026-09-27T23:59:59-03:00")).toBe(false);
    expect(v("REJECTED", "2026-09-28T22:00:00-03:00")).toBe(false);
    expect(v("READY", "2026-09-28T22:00:00-03:00", "IMAGE")).toBe(false);
  });
  it("counts PENDING only while fresh (< 1 h)", () => {
    expect(v("PENDING", new Date(now.getTime() - 10 * 60 * 1000).toISOString())).toBe(true);
    expect(v("PENDING", new Date(now.getTime() - STALE_PENDING_MS - 1).toISOString())).toBe(false);
  });
  it("prisma filter mirrors the rule and scopes by owner", () => {
    const w = videoQuotaWhere({ audience: "PARTNER", id: "p1" }, now);
    expect(w).toMatchObject({ partnerId: "p1", kind: "VIDEO", createdAt: { gte: new Date("2026-09-28T03:00:00Z") } });
    expect(videoQuotaWhere({ audience: "OWNER", id: "u1" }, now)).toMatchObject({ userId: "u1", partnerId: null });
  });
});

describe("plan limit errors", () => {
  it("duration → 402 PLAN_LIMIT with the maxSeconds feature", () => {
    const e = durationLimitError({ audience: "OWNER", id: "u" }, "owner_free", 30, 41.6);
    expect(e.status).toBe(402);
    expect(e.code).toBe("PLAN_LIMIT");
    expect(e.message).toBe("Seu plano permite vídeos de até 30 segundos.");
    expect(e.details).toEqual({ featureKey: "owner_video_max_seconds", current: 42, limit: 30, planKey: "owner_free" });
  });
  it("per day → 402 PLAN_LIMIT with singular/plural", () => {
    expect(perDayLimitError({ audience: "PARTNER", id: "p" }, "free", 1, 1).message).toBe("Seu plano permite 1 vídeo por dia. Tente novamente amanhã ou faça upgrade.");
    const e = perDayLimitError({ audience: "PARTNER", id: "p" }, "pro", 10, 10);
    expect(e.message).toBe("Seu plano permite 10 vídeos por dia. Tente novamente amanhã ou faça upgrade.");
    expect(e.details).toEqual({ featureKey: "videos_per_day", current: 10, limit: 10, planKey: "pro" });
  });
  it("audience of an asset", () => {
    expect(videoOwnerOf({ userId: null, partnerId: "p" })).toEqual({ audience: "PARTNER", id: "p" });
    expect(videoOwnerOf({ userId: "u", partnerId: null })).toEqual({ audience: "OWNER", id: "u" });
    expect(videoOwnerOf({ userId: null, partnerId: null })).toBeNull();
  });
});
