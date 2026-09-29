import { describe, expect, it } from "vitest";
import {
  appointmentBlock,
  availabilityWindows,
  dayBounds,
  findConflict,
  localDateStr,
  nearestNeighborOrder,
  nextDateStr,
  recurrenceDates,
  routeTotal,
  slotsFromWindows,
  subtractBusy,
  weekdayOf,
  withinWindows,
} from "./scheduling";

const T = (iso: string) => new Date(iso).getTime();

describe("timezone helpers (America/Sao_Paulo, UTC−3)", () => {
  it("dayBounds returns [00:00, 24:00) in local time", () => {
    const { start, end } = dayBounds("2026-10-05");
    expect(start.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-06T03:00:00.000Z");
  });
  it("weekdayOf / nextDateStr / localDateStr", () => {
    expect(weekdayOf("2026-10-05")).toBe(1); // Monday
    expect(weekdayOf("2026-10-04")).toBe(0);
    expect(nextDateStr("2026-10-31")).toBe("2026-11-01");
    expect(localDateStr(new Date("2026-10-06T01:30:00Z"))).toBe("2026-10-05"); // 22:30 local
  });
});

describe("availabilityWindows", () => {
  const rows = [
    { weekday: 1, startsAt: "08:00", endsAt: "12:00" },
    { weekday: 1, startsAt: "14:00", endsAt: "18:00" },
    { weekday: 2, startsAt: "09:00", endsAt: "17:00" },
  ];
  it("keeps only the weekday windows, converted to UTC instants", () => {
    const w = availabilityWindows("2026-10-05", rows); // Monday
    expect(w).toHaveLength(2);
    expect(new Date(w[0]!.start).toISOString()).toBe("2026-10-05T11:00:00.000Z");
    expect(new Date(w[0]!.end).toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(new Date(w[1]!.start).toISOString()).toBe("2026-10-05T17:00:00.000Z");
  });
  it("returns nothing on a day without availability", () => {
    expect(availabilityWindows("2026-10-04", rows)).toEqual([]);
  });
});

describe("subtractBusy", () => {
  it("splits windows around busy blocks", () => {
    const windows = [{ start: 0, end: 100 }];
    const free = subtractBusy(windows, [{ start: 20, end: 30 }, { start: 50, end: 60 }]);
    expect(free).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 50 },
      { start: 60, end: 100 },
    ]);
  });
  it("handles overlaps at the edges and full coverage", () => {
    expect(subtractBusy([{ start: 10, end: 50 }], [{ start: 0, end: 20 }])).toEqual([{ start: 20, end: 50 }]);
    expect(subtractBusy([{ start: 10, end: 50 }], [{ start: 0, end: 60 }])).toEqual([]);
    expect(subtractBusy([{ start: 10, end: 50 }], [{ start: 50, end: 60 }])).toEqual([{ start: 10, end: 50 }]);
  });
});

describe("slotsFromWindows", () => {
  const windows = availabilityWindows("2026-10-05", [{ weekday: 1, startsAt: "08:00", endsAt: "10:00" }]);
  it("generates 15-min stepped slots of the item duration", () => {
    const slots = slotsFromWindows({ windows, busy: [], durationMinutes: 60 });
    expect(slots.map((s) => new Date(s.start).toISOString())).toEqual([
      "2026-10-05T11:00:00.000Z",
      "2026-10-05T11:15:00.000Z",
      "2026-10-05T11:30:00.000Z",
      "2026-10-05T11:45:00.000Z",
      "2026-10-05T12:00:00.000Z",
    ]);
    expect(new Date(slots.at(-1)!.end).toISOString()).toBe("2026-10-05T13:00:00.000Z");
  });
  it("subtracts appointments + travel legs + buffer and realigns to the grid", () => {
    // appointment 08:30–09:00 local with a 10-min travel leg before and 5-min buffer → busy 08:15–09:05
    const busy = appointmentBlock({ startsAt: new Date("2026-10-05T11:30:00Z"), endsAt: new Date("2026-10-05T12:00:00Z"), travelLeg: { startsAt: new Date("2026-10-05T11:20:00Z") } }, 5);
    expect(new Date(busy.start).toISOString()).toBe("2026-10-05T11:15:00.000Z");
    expect(new Date(busy.end).toISOString()).toBe("2026-10-05T12:05:00.000Z");
    const slots = slotsFromWindows({ windows, busy: [busy], durationMinutes: 30 });
    // 08:00–08:15 is too short for 30 min; after the block the grid restarts at 09:15 local
    expect(slots.map((s) => new Date(s.start).toISOString())).toEqual(["2026-10-05T12:15:00.000Z", "2026-10-05T12:30:00.000Z"]);
  });
  it("respects notBefore (no slots in the past)", () => {
    const slots = slotsFromWindows({ windows, busy: [], durationMinutes: 60, notBefore: T("2026-10-05T11:50:00Z") });
    expect(new Date(slots[0]!.start).toISOString()).toBe("2026-10-05T12:00:00.000Z");
  });
  it("drops windows shorter than the duration", () => {
    expect(slotsFromWindows({ windows, busy: [], durationMinutes: 150 })).toEqual([]);
  });
});

describe("conflicts", () => {
  it("findConflict returns the overlapping block (touching edges are fine)", () => {
    const busy = [{ start: 10, end: 20, label: "A" }, { start: 30, end: 40, label: "B" }];
    expect(findConflict({ start: 20, end: 30 }, busy)).toBeNull();
    expect(findConflict({ start: 15, end: 25 }, busy)?.label).toBe("A");
    expect(findConflict({ start: 0, end: 100 }, busy)?.label).toBe("A");
  });
  it("withinWindows requires full containment", () => {
    const w = [{ start: 0, end: 50 }, { start: 60, end: 100 }];
    expect(withinWindows({ start: 10, end: 50 }, w)).toBe(true);
    expect(withinWindows({ start: 45, end: 65 }, w)).toBe(false);
  });
});

describe("recurrenceDates", () => {
  const start = new Date("2026-10-05T14:00:00Z");
  it("NONE → single date", () => {
    expect(recurrenceDates(start, "NONE", 5)).toEqual([start]);
  });
  it("WEEKLY / BIWEEKLY / MONTHLY", () => {
    expect(recurrenceDates(start, "WEEKLY", 3).map((d) => d.toISOString())).toEqual(["2026-10-05T14:00:00.000Z", "2026-10-12T14:00:00.000Z", "2026-10-19T14:00:00.000Z"]);
    expect(recurrenceDates(start, "BIWEEKLY", 2)[1]!.toISOString()).toBe("2026-10-19T14:00:00.000Z");
    expect(recurrenceDates(start, "MONTHLY", 2)[1]!.toISOString()).toBe("2026-11-05T14:00:00.000Z");
  });
  it("PACKAGE follows the given cadence (default weekly)", () => {
    expect(recurrenceDates(start, "PACKAGE", 10)).toHaveLength(10);
    expect(recurrenceDates(start, "PACKAGE", 2, "BIWEEKLY")[1]!.toISOString()).toBe("2026-10-19T14:00:00.000Z");
  });
});

describe("route suggestions", () => {
  it("nearest-neighbour picks the shorter tour and routeTotal sums legs", () => {
    // origin 0; stops 1,2,3 laid on a line: 0 -> 3 (1km) -> 2 (2km) -> 1 (3km)
    const km = [
      [0, 3, 2, 1],
      [3, 0, 1, 2],
      [2, 1, 0, 1],
      [1, 2, 1, 0],
    ];
    expect(nearestNeighborOrder(km)).toEqual([3, 2, 1]);
    expect(routeTotal(km, [1, 2, 3])).toBe(5);
    expect(routeTotal(km, [3, 2, 1])).toBe(3);
  });
});
