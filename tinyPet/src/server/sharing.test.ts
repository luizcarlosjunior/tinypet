import { describe, expect, it } from "vitest";
import { normalizeUsername, usernameProblem, usernameSchema, registerSchema, updateProfileSchema } from "@tinypet/shared";
import { canTransferNow, isExpired, ownerCanTransferFrom, parseHandle, transferEligibleAt, DAY_MS } from "./sharing";

const at = (iso: string) => new Date(iso);

describe("username rules", () => {
  it("accepts valid handles", () => {
    for (const u of ["abc", "joao.silva", "maria_22", "a1b", "x".repeat(30), "a.b_c.d"]) expect(usernameProblem(u)).toBeNull();
  });
  it("rejects invalid handles", () => {
    for (const u of ["ab", "x".repeat(31), ".abc", "abc.", "_abc", "abc_", "a..b", "Abc", "joão", "a b", "a-b", "a@b", ""]) expect(usernameProblem(u)).toBe("INVALID");
  });
  it("rejects reserved handles", () => {
    for (const u of ["admin", "tinypet", "suporte", "support", "root", "api", "www", "blog", "parceiro", "tutor", "null", "undefined"]) expect(usernameProblem(u)).toBe("RESERVED");
  });
  it("normalizes @, case and spaces", () => {
    expect(normalizeUsername("  @Joao.Silva ")).toBe("joao.silva");
    expect(usernameSchema.parse("@Maria_22")).toBe("maria_22");
    expect(usernameSchema.safeParse("ad").success).toBe(false);
    expect(usernameSchema.safeParse("admin").success).toBe(false);
  });
  it("is optional at registration and nullable on profile update", () => {
    const base = { name: "Fulano", email: "f@x.com", password: "12345678", acceptTerms: true as const };
    expect(registerSchema.parse(base).username).toBeUndefined();
    expect(registerSchema.parse({ ...base, username: "" }).username).toBeUndefined();
    expect(registerSchema.parse({ ...base, username: "@Fulano" }).username).toBe("fulano");
    expect(updateProfileSchema.parse({ username: null }).username).toBeNull();
    expect(updateProfileSchema.parse({ username: "" }).username).toBeNull();
    expect(updateProfileSchema.safeParse({ username: "a..b" }).success).toBe(false);
  });
});

describe("parseHandle", () => {
  it("detects e-mails and usernames", () => {
    expect(parseHandle("Foo@Bar.com")).toEqual({ kind: "email", email: "foo@bar.com" });
    expect(parseHandle("@joao")).toEqual({ kind: "username", username: "joao" });
    expect(parseHandle("Joao")).toEqual({ kind: "username", username: "joao" });
    // reserved names are still looked up (nobody can own them, so the lookup just misses)
    expect(parseHandle("admin")).toEqual({ kind: "username", username: "admin" });
  });
  it("returns null for garbage", () => {
    expect(parseHandle("")).toBeNull();
    expect(parseHandle("   ")).toBeNull();
    expect(parseHandle("a@b")).toBeNull();
    expect(parseHandle("@a")).toBeNull();
    expect(parseHandle("x..y")).toBeNull();
  });
});

describe("transfer eligibility (7 days of sharing, 7 days of ownership)", () => {
  const now = at("2026-09-29T12:00:00Z");

  it("pet never transferred: 7 days after the sharing started", () => {
    const since = at("2026-09-20T10:00:00Z");
    expect(transferEligibleAt(since, null).toISOString()).toBe("2026-09-27T10:00:00.000Z");
    expect(canTransferNow(since, null, now)).toBe(true);
    expect(canTransferNow(at("2026-09-23T12:00:01Z"), null, now)).toBe(false);
    expect(canTransferNow(at("2026-09-22T12:00:00Z"), null, now)).toBe(true); // exactly 7 days
  });

  it("owner cooldown wins when it ends later than the sharing rule", () => {
    const share = at("2026-09-01T00:00:00Z");
    const ownershipSince = at("2026-09-25T00:00:00Z");
    expect(transferEligibleAt(share, ownershipSince).toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(canTransferNow(share, ownershipSince, now)).toBe(false);
  });

  it("sharing rule wins when it ends later than the cooldown", () => {
    const share = at("2026-09-26T00:00:00Z");
    const ownershipSince = at("2026-09-01T00:00:00Z");
    expect(transferEligibleAt(share, ownershipSince).toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });

  it("after a transfer the previous owner (shared again now) can only get it back 7 days later", () => {
    const transferredAt = now;
    const eligible = transferEligibleAt(transferredAt, transferredAt);
    expect(eligible.getTime() - now.getTime()).toBe(7 * DAY_MS);
    expect(canTransferNow(transferredAt, transferredAt, new Date(now.getTime() + 7 * DAY_MS - 1))).toBe(false);
    expect(canTransferNow(transferredAt, transferredAt, new Date(now.getTime() + 7 * DAY_MS))).toBe(true);
  });

  it("ownerCanTransferFrom: null when never transferred or the cooldown is over", () => {
    expect(ownerCanTransferFrom(null, now)).toBeNull();
    expect(ownerCanTransferFrom(at("2026-09-20T00:00:00Z"), now)).toBeNull();
    expect(ownerCanTransferFrom(at("2026-09-27T00:00:00Z"), now)?.toISOString()).toBe("2026-10-04T00:00:00.000Z");
  });
});

describe("isExpired", () => {
  it("compares expiresAt with now", () => {
    const now = at("2026-09-29T12:00:00Z");
    expect(isExpired({ expiresAt: at("2026-09-29T11:59:59Z") }, now)).toBe(true);
    expect(isExpired({ expiresAt: at("2026-09-29T12:00:00Z") }, now)).toBe(true);
    expect(isExpired({ expiresAt: at("2026-09-29T12:00:01Z") }, now)).toBe(false);
  });
});
