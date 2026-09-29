import { describe, expect, it } from "vitest";
import { assertCanRegisterDeath, isTaskDueOn, weightAlertMessage, type PetActor } from "./pets";

describe("weightAlertMessage", () => {
  it("describes a gain in pt-BR with kg values", () => {
    expect(weightAlertMessage({ pct: 25, days: 30, direction: "gain", fromWeightG: 10000, toWeightG: 12500 })).toBe("Ganho de 25% de peso em até 30 dias (10,0 kg → 12,5 kg). Converse com o veterinário.");
  });
  it("uses the absolute value and a decimal comma for losses", () => {
    expect(weightAlertMessage({ pct: -12.5, days: 60, direction: "loss", fromWeightG: 8000, toWeightG: 7000 })).toMatch(/^Perda de 12,5% de peso em até 60 dias \(8,0 kg → 7,0 kg\)/);
  });
});

describe("isTaskDueOn", () => {
  const createdAt = new Date("2026-09-01T12:00:00Z");
  it("daily tasks are due every day after creation", () => {
    expect(isTaskDueOn({ rule: { freq: "daily", times: ["08:00"] }, dueAt: null, createdAt, status: "ACTIVE" }, "2026-09-29")).toBe(true);
    expect(isTaskDueOn({ rule: { freq: "daily" }, dueAt: null, createdAt, status: "ACTIVE" }, "2026-08-31")).toBe(false);
  });
  it("paused tasks are never due", () => {
    expect(isTaskDueOn({ rule: { freq: "daily" }, dueAt: null, createdAt, status: "PAUSED" }, "2026-09-29")).toBe(false);
  });
});

describe("monthly tasks", () => {
  it("fall on the last day of shorter months", () => {
    const task = { rule: { freq: "monthly", dayOfMonth: 31 }, dueAt: null, createdAt: new Date("2026-01-01T12:00:00Z"), status: "ACTIVE" };
    expect(isTaskDueOn(task, "2026-02-28")).toBe(true);
    expect(isTaskDueOn(task, "2026-02-27")).toBe(false);
    expect(isTaskDueOn(task, "2026-03-31")).toBe(true);
  });
});

describe("assertCanRegisterDeath", () => {
  const user = { id: "u1" } as PetActor["user"];
  const pet = (p: Partial<PetActor["pet"]> = {}): PetActor["pet"] => ({ id: "p1", name: "Rex", status: "ACTIVE", ownerId: null, createdByPartnerId: "partnerA", ...p });
  const partner = (partnerId: string, p?: Partial<PetActor["pet"]>): PetActor => ({ user, pet: pet(p), via: "partner", partnerId });

  it("allows the owner", () => {
    expect(() => assertCanRegisterDeath({ user, pet: pet({ ownerId: "u1" }), via: "owner" })).not.toThrow();
  });
  it("blocks shared accounts", () => {
    expect(() => assertCanRegisterDeath({ user, pet: pet({ ownerId: "u2" }), via: "family" })).toThrow(/tutor principal/);
  });
  it("allows the partner that created an ownerless pet", () => {
    expect(() => assertCanRegisterDeath(partner("partnerA"))).not.toThrow();
  });
  it("blocks another linked partner on an ownerless pet", () => {
    expect(() => assertCanRegisterDeath(partner("partnerB"))).toThrow(/parceiro que cadastrou/);
  });
  it("blocks partners once the pet has an owner", () => {
    expect(() => assertCanRegisterDeath(partner("partnerA", { ownerId: "u2" }))).toThrow(/apenas o tutor/);
  });
  it("rejects an already deceased pet", () => {
    expect(() => assertCanRegisterDeath({ user, pet: pet({ ownerId: "u1", status: "DECEASED" }), via: "owner" })).toThrow(/já foi registrado/);
  });
});
