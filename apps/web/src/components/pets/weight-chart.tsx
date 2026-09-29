"use client";
import { useId, useState } from "react";
import { fmtDate, fmtWeight, fmtDay } from "@/lib/format";
import { LIFE_STAGE_LABEL, type LifeStage } from "@tinypet/shared";

export type WeightPoint = { id: string; measuredAt: string; weightG: number; vetVerified: boolean; partnerId?: string | null };
export type StageBand = { stage: LifeStage; from: string; to: string | null };
export type ReferenceBand = { minG: number; maxG: number } | null;

const STAGE_FILL: Record<LifeStage, string> = { PUPPY: "rgba(251,125,60,0.10)", ADULT: "rgba(16,185,129,0.08)", SENIOR: "rgba(139,92,246,0.10)" };

/** Plain-SVG line chart of weight over time with life-stage bands, reference range and tutor/vet markers. */
export function WeightChart({ points, bands = [], reference = null, width = 640, height = 260 }: { points: WeightPoint[]; bands?: StageBand[]; reference?: ReferenceBand; width?: number; height?: number }) {
  const id = useId();
  const [hover, setHover] = useState<WeightPoint | null>(null);
  const sorted = [...points].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const pad = { l: 52, r: 16, t: 16, b: 36 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  if (sorted.length === 0) return <p className="text-sm text-[var(--muted)]">Sem registros de peso no período.</p>;

  const t = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).getTime();
  const xs = sorted.map((p) => t(p.measuredAt));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs, minX + 24 * 3600 * 1000);
  const ws = sorted.map((p) => p.weightG);
  let minY = Math.min(...ws, reference?.minG ?? Infinity);
  let maxY = Math.max(...ws, reference?.maxG ?? -Infinity);
  const span = Math.max(maxY - minY, Math.max(200, maxY * 0.1));
  minY = Math.max(0, minY - span * 0.15);
  maxY = maxY + span * 0.15;
  const x = (v: number) => pad.l + ((v - minX) / (maxX - minX)) * W;
  const y = (v: number) => pad.t + H - ((v - minY) / (maxY - minY)) * H;
  const path = sorted.map((p, i) => `${i ? "L" : "M"}${x(t(p.measuredAt)).toFixed(1)},${y(p.weightG).toFixed(1)}`).join(" ");
  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => minY + ((maxY - minY) * i) / yTicks);
  const xTickIdx = sorted.length <= 6 ? sorted.map((_, i) => i) : [0, Math.floor(sorted.length / 3), Math.floor((2 * sorted.length) / 3), sorted.length - 1];

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title`} className="h-auto w-full text-[var(--fg)]" onMouseLeave={() => setHover(null)}>
        <title id={`${id}-title`}>Evolução do peso: {sorted.length} registros, de {fmtDate(sorted[0]!.measuredAt)} a {fmtDate(sorted[sorted.length - 1]!.measuredAt)}</title>
        {bands.map((b) => {
          const x1 = Math.max(pad.l, x(t(b.from)));
          const x2 = Math.min(pad.l + W, b.to ? x(t(b.to)) : pad.l + W);
          if (x2 <= x1) return null;
          return (
            <g key={`${b.stage}-${b.from}`}>
              <rect x={x1} y={pad.t} width={x2 - x1} height={H} fill={STAGE_FILL[b.stage]} />
              <text x={x1 + 4} y={pad.t + 12} fontSize={10} fill="currentColor" opacity={0.6}>
                {LIFE_STAGE_LABEL[b.stage]}
              </text>
            </g>
          );
        })}
        {reference && <rect x={pad.l} y={y(reference.maxG)} width={W} height={Math.max(1, y(reference.minG) - y(reference.maxG))} fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.4)" strokeDasharray="4 3" />}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={pad.l + W} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.12} />
            <text x={pad.l - 6} y={y(v) + 3} fontSize={10} textAnchor="end" fill="currentColor" opacity={0.7}>
              {fmtWeight(Math.round(v))}
            </text>
          </g>
        ))}
        {xTickIdx.map((i) => (
          <text key={i} x={x(xs[i]!)} y={height - 10} fontSize={10} textAnchor="middle" fill="currentColor" opacity={0.7}>
            {fmtDate(sorted[i]!.measuredAt, "dd/MM/yy")}
          </text>
        ))}
        <path d={path} fill="none" stroke="#f95d16" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {sorted.map((p) => (
          <g key={p.id} onMouseEnter={() => setHover(p)} onFocus={() => setHover(p)} tabIndex={0} aria-label={`${fmtDay(p.measuredAt)}: ${fmtWeight(p.weightG)}${p.vetVerified ? ", aferido por veterinário" : ""}`}>
            {p.vetVerified ? (
              <rect x={x(t(p.measuredAt)) - 5} y={y(p.weightG) - 5} width={10} height={10} fill="#2563eb" stroke="white" strokeWidth={1.5} transform={`rotate(45 ${x(t(p.measuredAt))} ${y(p.weightG)})`} />
            ) : (
              <circle cx={x(t(p.measuredAt))} cy={y(p.weightG)} r={5} fill="#f95d16" stroke="white" strokeWidth={1.5} />
            )}
          </g>
        ))}
        {hover && (
          <g pointerEvents="none">
            <rect x={Math.min(x(t(hover.measuredAt)) + 8, width - 150)} y={Math.max(pad.t, y(hover.weightG) - 34)} width={142} height={30} rx={6} fill="var(--card)" stroke="var(--border)" />
            <text x={Math.min(x(t(hover.measuredAt)) + 14, width - 144)} y={Math.max(pad.t, y(hover.weightG) - 34) + 12} fontSize={10} fill="currentColor">
              {fmtDay(hover.measuredAt)} · {fmtWeight(hover.weightG)}
            </text>
            <text x={Math.min(x(t(hover.measuredAt)) + 14, width - 144)} y={Math.max(pad.t, y(hover.weightG) - 34) + 24} fontSize={10} fill="currentColor" opacity={0.7}>
              {hover.vetVerified ? "Aferido por veterinário" : "Registrado pelo tutor"}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden /> Tutor
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rotate-45 bg-blue-600" aria-hidden /> Veterinário
        </span>
        {reference && <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-4 bg-emerald-500/30" aria-hidden /> Faixa de referência</span>}
        {bands.length > 0 && <span>Fundo: fases da vida</span>}
      </figcaption>
    </figure>
  );
}
