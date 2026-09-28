"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bodyMeasurementSchema, LIFE_STAGE_LABEL } from "@tinypet/shared";
import type { z } from "zod";
import { AlertTriangle, Plus } from "lucide-react";
import { Badge, Button, Input, Modal, Spinner, Textarea } from "@/components/ui";
import { ErrorBox, Table, td, th } from "@/components/painel/ui";
import { useApiMutation, usePetMeasurements } from "@/hooks/use-crm";
import { fmtDate, num, todayISO } from "@/lib/format";
import type { Measurement } from "@/types/api";

type MeasurementInput = z.infer<typeof bodyMeasurementSchema>;

export function MeasurementsTab({ petId }: { petId: string }) {
  const [period, setPeriod] = useState<"6m" | "1y" | "all">("1y");
  const [open, setOpen] = useState(false);
  const q = usePetMeasurements(petId, period);
  const create = useApiMutation<MeasurementInput>({ path: () => `/pets/${petId}/measurements`, body: (v) => v, invalidate: [["pet", petId, "measurements"], ["pet", petId, "history"]], success: "Medida registrada", onSuccess: () => setOpen(false) });
  const items = [...(q.data?.items ?? [])].sort((a, b) => (a.measuredAt < b.measuredAt ? -1 : 1));
  const alerts = (q.data?.alerts ?? []).map((a) => (typeof a === "string" ? a : a.message));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="m-period" className="text-[var(--muted)]">
            Período
          </label>
          <select id="m-period" className="input w-auto" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
            <option value="6m">6 meses</option>
            <option value="1y">1 ano</option>
            <option value="all">Tudo</option>
          </select>
          {q.data?.lifeStage && <Badge tone="blue">{LIFE_STAGE_LABEL[q.data.lifeStage]}</Badge>}
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Nova medida
        </Button>
      </div>
      {alerts.length > 0 && (
        <ul className="space-y-1">
          {alerts.map((a, i) => (
            <li key={i} role="alert" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {a}
            </li>
          ))}
        </ul>
      )}
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : (
        <>
          <section className="card">
            <h3 className="mb-2 text-sm font-semibold">Evolução do peso</h3>
            {items.length < 1 ? <p className="text-sm text-[var(--muted)]">Registre a primeira pesagem para ver o gráfico.</p> : <WeightChart items={items} reference={q.data?.reference ?? null} />}
          </section>
          <Table>
            <thead>
              <tr>
                <th className={th}>Data</th>
                <th className={th}>Peso</th>
                <th className={`${th} hidden sm:table-cell`}>Altura</th>
                <th className={`${th} hidden sm:table-cell`}>Comprimento</th>
                <th className={`${th} hidden md:table-cell`}>Pescoço / Tórax / Abdômen</th>
                <th className={th}>ECC</th>
                <th className={`${th} hidden md:table-cell`}>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td className={`${td} text-[var(--muted)]`} colSpan={7}>
                    Nenhuma medida no período.
                  </td>
                </tr>
              )}
              {[...items].reverse().map((m) => (
                <tr key={m.id}>
                  <td className={td}>
                    {fmtDate(m.measuredAt)} {m.vetVerified && <Badge tone="green" className="ml-1">Vet</Badge>}
                  </td>
                  <td className={`${td} font-medium`}>{(m.weightG / 1000).toFixed(2).replace(".", ",")} kg</td>
                  <td className={`${td} hidden sm:table-cell`}>{m.heightCm ? `${num(m.heightCm)} cm` : "—"}</td>
                  <td className={`${td} hidden sm:table-cell`}>{m.lengthCm ? `${num(m.lengthCm)} cm` : "—"}</td>
                  <td className={`${td} hidden md:table-cell`}>{[m.neckCm, m.chestCm, m.abdomenCm].map((v) => (v ? `${num(v)}` : "—")).join(" / ")} cm</td>
                  <td className={td}>{m.bodyScore ?? "—"}</td>
                  <td className={`${td} hidden max-w-[200px] truncate md:table-cell`}>{m.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nova medida">
        {open && <MeasurementForm submitting={create.isPending} onCancel={() => setOpen(false)} onSubmit={(v) => create.mutate(v)} />}
      </Modal>
    </div>
  );
}

function WeightChart({ items, reference }: { items: Measurement[]; reference: { minWeightG: number; maxWeightG: number } | null }) {
  const W = 640;
  const H = 220;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const xs = items.map((m) => new Date(m.measuredAt.slice(0, 10) + "T12:00:00").getTime());
  const ys = items.map((m) => m.weightG / 1000);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const allY = [...ys, ...(reference ? [reference.minWeightG / 1000, reference.maxWeightG / 1000] : [])];
  let minY = Math.min(...allY);
  let maxY = Math.max(...allY);
  if (maxY - minY < 0.5) {
    minY -= 0.25;
    maxY += 0.25;
  }
  const padY = (maxY - minY) * 0.1;
  minY = Math.max(0, minY - padY);
  maxY += padY;
  const sx = (x: number) => (maxX === minX ? pad.l + (W - pad.l - pad.r) / 2 : pad.l + ((x - minX) / (maxX - minX)) * (W - pad.l - pad.r));
  const sy = (y: number) => pad.t + (1 - (y - minY) / (maxY - minY)) * (H - pad.t - pad.b);
  const path = items.map((m, i) => `${i === 0 ? "M" : "L"}${sx(xs[i]!).toFixed(1)},${sy(ys[i]!).toFixed(1)}`).join(" ");
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minY + ((maxY - minY) * i) / ticks);
  const xLabels = items.length > 6 ? [items[0]!, items[Math.floor(items.length / 2)]!, items[items.length - 1]!] : items;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Gráfico de peso com ${items.length} registros, de ${(ys[0] ?? 0).toFixed(1)} a ${(ys[ys.length - 1] ?? 0).toFixed(1)} kg`}>
      {reference && <rect x={pad.l} y={sy(reference.maxWeightG / 1000)} width={W - pad.l - pad.r} height={Math.max(0, sy(reference.minWeightG / 1000) - sy(reference.maxWeightG / 1000))} className="fill-emerald-500/10" />}
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} className="stroke-[var(--border)]" strokeWidth={1} />
          <text x={pad.l - 6} y={sy(t) + 4} textAnchor="end" className="fill-[var(--muted)] text-[11px]">
            {t.toFixed(1)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" className="stroke-brand-500" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {items.map((m, i) => (
        <circle key={m.id} cx={sx(xs[i]!)} cy={sy(ys[i]!)} r={4} className={m.vetVerified ? "fill-emerald-500" : "fill-brand-500"}>
          <title>
            {fmtDate(m.measuredAt)}: {ys[i]!.toFixed(2)} kg
          </title>
        </circle>
      ))}
      {xLabels.map((m) => (
        <text key={m.id} x={sx(new Date(m.measuredAt.slice(0, 10) + "T12:00:00").getTime())} y={H - 8} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
          {fmtDate(m.measuredAt).slice(0, 5)}
        </text>
      ))}
      {reference && (
        <text x={W - pad.r} y={sy(reference.maxWeightG / 1000) - 4} textAnchor="end" className="fill-emerald-600 text-[10px]">
          faixa de referência
        </text>
      )}
    </svg>
  );
}

function MeasurementForm({ onSubmit, onCancel, submitting }: { onSubmit: (v: MeasurementInput) => void; onCancel: () => void; submitting?: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<MeasurementInput>({ resolver: zodResolver(bodyMeasurementSchema), defaultValues: { measuredAt: todayISO() } });
  const opt = { setValueAs: (v: unknown) => (v === "" || v == null ? null : Number(v)) };
  return (
    <form noValidate className="space-y-3" onSubmit={handleSubmit((v) => onSubmit({ ...v, notes: v.notes || null }))}>
      <div className="grid grid-cols-2 gap-3">
        <Input id="bm-date" type="date" label="Data" {...register("measuredAt")} error={errors.measuredAt?.message} />
        <Input id="bm-weight" type="number" step="1" min={1} label="Peso (g)" placeholder="ex.: 8500" {...register("weightG")} error={errors.weightG?.message} />
        <Input id="bm-height" type="number" step="0.1" label="Altura (cm)" {...register("heightCm", opt)} />
        <Input id="bm-length" type="number" step="0.1" label="Comprimento (cm)" {...register("lengthCm", opt)} />
        <Input id="bm-neck" type="number" step="0.1" label="Pescoço (cm)" {...register("neckCm", opt)} />
        <Input id="bm-chest" type="number" step="0.1" label="Tórax (cm)" {...register("chestCm", opt)} />
        <Input id="bm-abd" type="number" step="0.1" label="Abdômen (cm)" {...register("abdomenCm", opt)} />
        <Input id="bm-score" type="number" min={1} max={9} label="Escore corporal (1–9)" {...register("bodyScore", opt)} error={errors.bodyScore?.message} />
      </div>
      <Textarea id="bm-notes" label="Observações" className="min-h-[60px]" {...register("notes")} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
