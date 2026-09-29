import { describe, expect, it } from "vitest";
import { bucketKeys, buildSeries, liveDayRows, resolvePeriod } from "./period";

const now = new Date("2026-09-29T15:00:00Z"); // 12:00 in São Paulo

describe("resolvePeriod", () => {
  it("presets", () => {
    expect(resolvePeriod({ period: "7d" }, now)).toEqual({ from: "2026-09-23", to: "2026-09-29", days: 7, granularity: "day" });
    expect(resolvePeriod({ period: "30d" }, now)).toMatchObject({ from: "2026-08-31", days: 30, granularity: "day" });
    expect(resolvePeriod({ period: "90d" }, now)).toMatchObject({ days: 90, granularity: "day" });
    expect(resolvePeriod({ period: "12m" }, now)).toMatchObject({ from: "2025-10-01", to: "2026-09-29", granularity: "month" });
  });
  it("uses the São Paulo day near midnight UTC", () => {
    expect(resolvePeriod({ period: "7d" }, new Date("2026-09-30T01:00:00Z")).to).toBe("2026-09-29");
  });
  it("custom ranges", () => {
    expect(resolvePeriod({ period: "custom", from: "2026-01-01", to: "2026-03-31" }, now)).toMatchObject({ days: 90, granularity: "day" });
    expect(resolvePeriod({ period: "custom", from: "2026-01-01", to: "2026-04-01" }, now)).toMatchObject({ days: 91, granularity: "month" });
    expect(() => resolvePeriod({ period: "custom", from: "2026-02-30", to: "2026-03-01" }, now)).toThrow();
    expect(() => resolvePeriod({ period: "custom", from: "2026-03-02", to: "2026-03-01" }, now)).toThrow();
    expect(() => resolvePeriod({ period: "custom", from: "2020-01-01", to: "2026-03-01" }, now)).toThrow();
    expect(() => resolvePeriod({ period: "custom", from: "2026-01-01' OR 1=1", to: "2026-03-01" }, now)).toThrow();
  });
});

describe("buckets", () => {
  it("lists day and month keys", () => {
    expect(bucketKeys({ from: "2026-02-27", to: "2026-03-02", granularity: "day" })).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(bucketKeys({ from: "2025-11-15", to: "2026-02-01", granularity: "month" })).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("zero-fills and sums rows", () => {
    const p = { from: "2026-09-27", to: "2026-09-29", granularity: "day" as const };
    const s = buildSeries(p, [{ day: "2026-09-27", views: 3, visitors: 2 }, { day: "2026-09-27", views: 1, visitors: 1 }, { day: "2026-09-29", views: 5, visitors: 4 }, { day: "2026-09-26", views: 99, visitors: 99 }], ["2026-09-28", "2026-09-28", "2026-10-01"]);
    expect(s).toEqual([
      { bucket: "2026-09-27", views: 4, visitors: 3, published: 0 },
      { bucket: "2026-09-28", views: 0, visitors: 0, published: 2 },
      { bucket: "2026-09-29", views: 5, visitors: 4, published: 0 },
    ]);
  });
  it("buckets by month", () => {
    const s = buildSeries({ from: "2026-01-10", to: "2026-03-05", granularity: "month" }, [{ day: "2026-01-31", views: 2, visitors: 1 }, { day: "2026-02-01", views: 3, visitors: 3 }, { day: "2026-03-05", views: 1, visitors: 1 }]);
    expect(s.map((x) => [x.bucket, x.views])).toEqual([["2026-01", 2], ["2026-02", 3], ["2026-03", 1]]);
  });
});

describe("unprocessed logs in the series", () => {
  it("groups live logs by São Paulo day and adds them to the aggregated rows", () => {
    const live = liveDayRows([
      { visitorHash: "a", createdAt: new Date("2026-09-29T05:00:00Z") },
      { visitorHash: "a", createdAt: new Date("2026-09-29T06:00:00Z") },
      { visitorHash: "b", createdAt: new Date("2026-09-29T14:00:00Z") },
      { visitorHash: "c", createdAt: new Date("2026-09-29T02:00:00Z") }, // 23:00 on the 28th in SP
    ]);
    expect(live.sort((x, y) => x.day.localeCompare(y.day))).toEqual([
      { day: "2026-09-28", views: 1, visitors: 1 },
      { day: "2026-09-29", views: 3, visitors: 2 },
    ]);
    const p = resolvePeriod({ period: "7d" }, now);
    const series = buildSeries(p, [{ day: "2026-09-29", views: 10, visitors: 4 }, ...live]);
    expect(series.at(-1)).toMatchObject({ bucket: "2026-09-29", views: 13, visitors: 6 });
    expect(series.at(-2)).toMatchObject({ bucket: "2026-09-28", views: 1 });
    expect(series.reduce((a, x) => a + x.views, 0)).toBe(14);
  });
});
