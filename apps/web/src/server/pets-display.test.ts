import { describe, expect, it } from "vitest";
import { isTaskDueOn, weightAlertMessage } from "./pets";

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
