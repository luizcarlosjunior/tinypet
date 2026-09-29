import { describe, expect, it } from "vitest";
import { splitInstallmentsPreview } from "./installments";
import { splitInstallments } from "@/server/finance";

describe("contract form preview = API split", () => {
  it("matches the server split for many totals/counts", () => {
    for (const total of [0.01, 0.05, 1, 10, 99.99, 100, 200, 333.33, 1000, 1234.56]) {
      for (const count of [1, 2, 3, 4, 6, 7, 12, 60]) {
        const ui = splitInstallmentsPreview(total, count, "2026-01-31", "MONTHLY").map((p) => Math.round(p.amount * 100));
        expect(ui).toEqual(splitInstallments(Math.round(total * 100), count));
      }
    }
  });
  it("R$ 200 in 3 → 66,67 / 66,67 / 66,66 with monthly dates", () => {
    const p = splitInstallmentsPreview(200, 3, "2026-01-31", "MONTHLY");
    expect(p.map((x) => x.amount)).toEqual([66.67, 66.67, 66.66]);
    expect(p.map((x) => x.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});
