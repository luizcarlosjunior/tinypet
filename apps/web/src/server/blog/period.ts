/** Stats periods and bucketing (pure). Day keys are America/Sao_Paulo calendar days. */
import { addDays, spDayKey } from "./utils";

/** Not-yet-processed view logs → per-SP-day rows (views, distinct visitors), to merge with BlogPostDailyStat rows. */
export function liveDayRows(logs: { visitorHash: string; createdAt: Date }[]): DayRow[] {
  const byDay = new Map<string, { views: number; visitors: Set<string> }>();
  for (const l of logs) {
    const d = spDayKey(l.createdAt);
    const e = byDay.get(d) ?? { views: 0, visitors: new Set<string>() };
    e.views++;
    e.visitors.add(l.visitorHash);
    byDay.set(d, e);
  }
  return Array.from(byDay, ([day, e]) => ({ day, views: e.views, visitors: e.visitors.size }));
}

export type StatsPeriodKey = "7d" | "30d" | "90d" | "12m" | "custom";
export type Granularity = "day" | "month";
export type ResolvedPeriod = { from: string; to: string; days: number; granularity: Granularity };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_CUSTOM_DAYS = 3 * 366;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function validDay(s: string | undefined): s is string {
  return !!s && DAY_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
}

/** Inclusive [from, to] day range for a preset (or custom from/to), granularity day when ≤ 90 days, else month. */
export function resolvePeriod(input: { period?: string; from?: string; to?: string }, now = new Date()): ResolvedPeriod {
  const today = spDayKey(now);
  let from: string;
  let to = today;
  switch (input.period ?? "30d") {
    case "7d":
      from = addDays(today, -6);
      break;
    case "90d":
      from = addDays(today, -89);
      break;
    case "12m": {
      const [y, m] = today.split("-").map(Number) as [number, number];
      const d = new Date(Date.UTC(y, m - 1 - 11, 1));
      from = d.toISOString().slice(0, 10);
      break;
    }
    case "custom": {
      if (!validDay(input.from) || !validDay(input.to)) throw new RangeError("Informe from e to no formato AAAA-MM-DD");
      from = input.from;
      to = input.to;
      if (from > to) throw new RangeError("A data inicial deve ser anterior à final");
      if (daysBetween(from, to) > MAX_CUSTOM_DAYS) throw new RangeError("Período máximo de 3 anos");
      break;
    }
    case "30d":
    default:
      from = addDays(today, -29);
  }
  const days = daysBetween(from, to);
  return { from, to, days, granularity: days <= 90 ? "day" : "month" };
}

export function bucketOf(dayKey: string, g: Granularity): string {
  return g === "day" ? dayKey : dayKey.slice(0, 7);
}

/** Every bucket key in the range, in order (zero-filled series). */
export function bucketKeys(p: Pick<ResolvedPeriod, "from" | "to" | "granularity">): string[] {
  const out: string[] = [];
  if (p.granularity === "day") {
    for (let d = p.from; d <= p.to; d = addDays(d, 1)) out.push(d);
    return out;
  }
  let [y, m] = p.from.slice(0, 7).split("-").map(Number) as [number, number];
  const end = p.to.slice(0, 7);
  for (;;) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    if (k > end) break;
    out.push(k);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export type DayRow = { day: string; views: number; visitors: number };
export type SeriesPoint = { bucket: string; views: number; visitors: number; published: number };

/** Sums per-day rows (and publication days) into zero-filled buckets. Rows outside the range are ignored. */
export function buildSeries(p: Pick<ResolvedPeriod, "from" | "to" | "granularity">, rows: DayRow[], publishedDays: string[] = []): SeriesPoint[] {
  const map = new Map<string, SeriesPoint>(bucketKeys(p).map((b) => [b, { bucket: b, views: 0, visitors: 0, published: 0 }]));
  for (const r of rows) {
    if (r.day < p.from || r.day > p.to) continue;
    const pt = map.get(bucketOf(r.day, p.granularity));
    if (!pt) continue;
    pt.views += r.views;
    pt.visitors += r.visitors;
  }
  for (const d of publishedDays) {
    if (d < p.from || d > p.to) continue;
    const pt = map.get(bucketOf(d, p.granularity));
    if (pt) pt.published++;
  }
  return Array.from(map.values());
}
