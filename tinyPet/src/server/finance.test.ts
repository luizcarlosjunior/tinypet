import { describe, expect, it } from "vitest";
import { contractTotals, daysLate, formatDateBR, formatNumberBR, installmentDueDates, monthKey, splitInstallments, toCents, toCsv } from "./finance";

describe("money in cents", () => {
  it("toCents rounds and accepts Decimal-like values", () => {
    expect(toCents(10.005)).toBe(1001);
    expect(toCents("19.99")).toBe(1999);
    expect(toCents({ toString: () => "0.1" })).toBe(10);
    expect(toCents(null)).toBe(0);
  });
  it("contractTotals = Σ qty×unitPrice − discount (capped at total)", () => {
    const t = contractTotals([{ quantity: 10, unitPrice: 150 }, { quantity: 1, unitPrice: 0.1 }], 100.1);
    expect(t).toEqual({ totalCents: 150010, discountCents: 10010, netCents: 140000 });
    expect(contractTotals([{ quantity: 1, unitPrice: 50 }], 80).netCents).toBe(0);
  });
});

describe("splitInstallments", () => {
  it("splits evenly; last absorbs rounding", () => {
    expect(splitInstallments(100000, 3)).toEqual([33333, 33333, 33334]);
    expect(splitInstallments(100000, 4)).toEqual([25000, 25000, 25000, 25000]);
    expect(splitInstallments(1000, 3)).toEqual([333, 333, 334]);
    expect(splitInstallments(200, 3)).toEqual([67, 67, 66]);
  });
  it("always sums to the net amount", () => {
    for (const [net, n] of [[123457, 7], [99, 12], [1, 3], [1000000, 60]] as const) {
      const parts = splitInstallments(net, n);
      expect(parts).toHaveLength(n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(net);
      expect(parts.every((p) => p >= 0)).toBe(true);
    }
  });
  it("rejects invalid count", () => {
    expect(() => splitInstallments(100, 0)).toThrow();
  });
});

describe("installmentDueDates", () => {
  it("MONTHLY keeps the day of month", () => {
    const d = installmentDueDates("2026-01-10", "MONTHLY", 3).map((x) => x.toISOString().slice(0, 10));
    expect(d).toEqual(["2026-01-10", "2026-02-10", "2026-03-10"]);
  });
  it("WEEKLY / BIWEEKLY add 7 / 14 days", () => {
    expect(installmentDueDates("2026-03-01", "WEEKLY", 2).map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-03-01", "2026-03-08"]);
    expect(installmentDueDates("2026-03-01", "BIWEEKLY", 2).map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-03-01", "2026-03-15"]);
  });
  it("rejects invalid dates", () => {
    expect(() => installmentDueDates("2026-13-40", "MONTHLY", 1)).toThrow();
  });
});

describe("formatting", () => {
  it("pt-BR helpers", () => {
    expect(formatNumberBR(1234.5)).toBe("1234,50");
    expect(formatDateBR(new Date("2026-02-03T12:00:00Z"))).toBe("03/02/2026");
    expect(monthKey(new Date("2026-02-03T12:00:00Z"))).toBe("2026-02");
    expect(daysLate(new Date("2026-01-01T12:00:00Z"), new Date("2026-01-11T03:00:00Z"))).toBe(10);
    expect(daysLate(new Date("2026-01-20T12:00:00Z"), new Date("2026-01-11T03:00:00Z"))).toBe(0);
  });
  it("toCsv uses BOM, ';' separator, pt-BR decimals and quotes when needed", () => {
    const csv = toCsv(["A", "Valor", "Data"], [["x;y", 10.5, new Date("2026-02-03T12:00:00Z")], ['say "hi"', 0, null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("A;Valor;Data");
    expect(lines[1]).toBe('"x;y";10,50;03/02/2026');
    expect(lines[2]).toBe('"say ""hi""";0,00;');
  });
});
