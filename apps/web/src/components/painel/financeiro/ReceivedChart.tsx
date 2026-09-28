"use client";
import { useId } from "react";
import { formatBRL } from "@tinypet/shared";
import { fmtDateKey, num } from "@/lib/format";

/** Inline-SVG bar chart of amounts received per month. */
export function ReceivedChart({ data, height = 200 }: { data: { month: string; amount: number | string }[]; height?: number }) {
  const id = useId();
  const rows = data.map((d) => ({ month: d.month, amount: num(d.amount) }));
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-[var(--muted)]">Sem recebimentos no período.</p>;
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const padL = 56;
  const padB = 28;
  const padT = 12;
  const width = Math.max(320, rows.length * 56 + padL + 12);
  const innerH = height - padB - padT;
  const barW = Math.min(40, ((width - padL - 12) / rows.length) * 0.6);
  const step = (width - padL - 12) / rows.length;
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const label = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? fmtDateKey(`${m}-01`, "MMM/yy") : m);
  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="text-[var(--fg)]">
        <title id={`${id}-t`}>Recebido por mês</title>
        <desc id={`${id}-d`}>{rows.map((r) => `${label(r.month)}: ${formatBRL(r.amount)}`).join("; ")}</desc>
        {ticks.map((t) => {
          const y = padT + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={width - 8} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.12} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.7}>
                {t >= 1000 ? `${Math.round(t / 1000)}k` : Math.round(t)}
              </text>
            </g>
          );
        })}
        {rows.map((r, i) => {
          const h = (r.amount / max) * innerH;
          const x = padL + i * step + (step - barW) / 2;
          const y = padT + innerH - h;
          return (
            <g key={r.month}>
              <rect x={x} y={y} width={barW} height={h} rx={4} className="fill-brand-500">
                <title>{`${label(r.month)}: ${formatBRL(r.amount)}`}</title>
              </rect>
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.8}>
                {label(r.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
