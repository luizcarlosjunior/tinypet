import { describe, expect, it } from "vitest";
import { mediaAuditDecisionSchema, mediaReportSchema } from "@tinypet/shared";
import { accountSuspendedError, isAttributableIp, PERMANENT_UNTIL, sanctionEndsAt } from "./sanctions";

describe("isAttributableIp", () => {
  it("never attributes unknown, loopback or private addresses (they'd block everyone)", () => {
    for (const ip of ["0.0.0.0", "127.0.0.1", "::1", "10.0.0.5", "192.168.1.20", "172.16.0.1", "172.31.255.1", "fd00::1", "", null, undefined]) expect(isAttributableIp(ip)).toBe(false);
  });
  it("attributes public addresses", () => {
    for (const ip of ["203.0.113.10", "177.10.20.30", "172.32.0.1", "2804:14c::1"]) expect(isAttributableIp(ip)).toBe(true);
  });
});

describe("sanctionEndsAt", () => {
  const from = new Date("2026-09-29T12:00:00.000Z");
  it("adds the days, null for permanent", () => {
    expect(sanctionEndsAt(7, from)?.toISOString()).toBe("2026-10-06T12:00:00.000Z");
    expect(sanctionEndsAt(30, from)?.toISOString()).toBe("2026-10-29T12:00:00.000Z");
    expect(sanctionEndsAt("PERMANENT", from)).toBeNull();
  });
});

describe("accountSuspendedError", () => {
  it("formats the end date in pt-BR (São Paulo)", () => {
    const e = accountSuspendedError(new Date("2026-10-06T02:00:00.000Z"));
    expect(e.status).toBe(403);
    expect(e.code).toBe("ACCOUNT_SUSPENDED");
    expect(e.message).toContain("05/10/2026");
  });
  it("says permanent for the sentinel date", () => {
    expect(accountSuspendedError(PERMANENT_UNTIL).message).toMatch(/permanentemente/);
  });
});

describe("mediaReportSchema", () => {
  it("requires details for OTHER", () => {
    expect(mediaReportSchema.safeParse({ url: "https://x.test/a.webp", reason: "OTHER" }).success).toBe(false);
    expect(mediaReportSchema.safeParse({ url: "https://x.test/a.webp", reason: "OTHER", details: "conteúdo estranho" }).success).toBe(true);
    expect(mediaReportSchema.safeParse({ url: "https://x.test/a.webp", reason: "SPAM_SCAM" }).success).toBe(true);
  });
});

describe("mediaAuditDecisionSchema", () => {
  const base = { reason: "Conteúdo impróprio" };
  it("uploader sanctions only when deleting; reporter sanctions only when dismissing", () => {
    expect(mediaAuditDecisionSchema.safeParse({ ...base, action: "DELETE", uploader: { blockIp: true, account: 30 } }).success).toBe(true);
    expect(mediaAuditDecisionSchema.safeParse({ ...base, action: "DISMISS", uploader: { blockIp: true } }).success).toBe(false);
    expect(mediaAuditDecisionSchema.safeParse({ ...base, action: "DISMISS", reporters: [{ userId: "u1", type: "REPORTS", duration: "PERMANENT" }] }).success).toBe(true);
    expect(mediaAuditDecisionSchema.safeParse({ ...base, action: "DELETE", reporters: [{ userId: "u1", type: "ACCOUNT", duration: 7 }] }).success).toBe(false);
  });
  it("only 7/15/30/PERMANENT and a reason of 5+ chars", () => {
    expect(mediaAuditDecisionSchema.safeParse({ ...base, action: "DELETE", uploader: { account: 10 } }).success).toBe(false);
    expect(mediaAuditDecisionSchema.safeParse({ action: "DELETE", reason: "x" }).success).toBe(false);
  });
});
