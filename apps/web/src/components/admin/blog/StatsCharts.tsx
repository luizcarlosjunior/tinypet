"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BlogStats } from "@/hooks/use-blog-admin";
import { fmtInt } from "./common";

/** Validated categorical slots (dataviz reference palette): 1 blue, 2 orange, 3 aqua. */
export const SERIES = { views: "#2a78d6", visitors: "#eb6834", published: "#1baf7a" };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function bucketLabel(b: string) {
  const d = b.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[3]}/${d[2]}`;
  const m = b.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MONTHS[Number(m[2]) - 1] ?? m[2]}/${m[1]!.slice(2)}`;
  return b;
}

const axis = { tick: { fill: "currentColor", fontSize: 11 }, stroke: "currentColor", strokeOpacity: 0.25, tickLine: false } as const;
const tooltipStyle = { contentStyle: { background: "var(--card)", border: "1px solid rgba(104,116,142,.3)", borderRadius: 12, fontSize: 12, color: "var(--fg)" }, labelStyle: { color: "var(--fg)", fontWeight: 600 }, itemStyle: { color: "var(--fg)" } };

export function ViewsAreaChart({ series }: { series: BlogStats["series"] }) {
  const data = series.map((s) => ({ ...s, label: bucketLabel(s.bucket) }));
  return (
    <div className="h-72 text-[var(--muted)]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.views} stopOpacity={0.25} />
              <stop offset="100%" stopColor={SERIES.views} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.visitors} stopOpacity={0.2} />
              <stop offset="100%" stopColor={SERIES.visitors} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
          <XAxis dataKey="label" {...axis} minTickGap={16} />
          <YAxis {...axis} axisLine={false} allowDecimals={false} width={48} tickFormatter={(v: number) => fmtInt(v)} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => fmtInt(v)} cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }} />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--fg)" }} iconType="plainline" />
          <Area type="monotone" dataKey="views" name="Visualizações" stroke={SERIES.views} strokeWidth={2} fill="url(#gViews)" dot={false} activeDot={{ r: 4 }} />
          <Area type="monotone" dataKey="visitors" name="Visitantes" stroke={SERIES.visitors} strokeWidth={2} fill="url(#gVisitors)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PublishedBarChart({ series }: { series: BlogStats["series"] }) {
  const data = series.map((s) => ({ label: bucketLabel(s.bucket), published: s.published }));
  return (
    <div className="h-56 text-[var(--muted)]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
          <XAxis dataKey="label" {...axis} minTickGap={16} />
          <YAxis {...axis} axisLine={false} allowDecimals={false} width={48} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "currentColor", fillOpacity: 0.08 }} />
          <Bar dataKey="published" name="Posts publicados" fill={SERIES.published} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal magnitude bars (single hue) with value labels in text ink. */
export function RankBars({ rows, empty = "Sem dados no período." }: { rows: { label: string; value: number }[]; empty?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-[var(--muted)]">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${fmtInt(r.value)} (${Math.round((r.value / total) * 100)}%)`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-[var(--muted)]">
              {fmtInt(r.value)} <span className="text-xs">({Math.round((r.value / total) * 100)}%)</span>
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: SERIES.views }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
