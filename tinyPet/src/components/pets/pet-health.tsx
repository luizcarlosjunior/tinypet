"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, BadgeCheck, Download, Pencil, Plus, Syringe, Trash2 } from "lucide-react";
import { bodyMeasurementSchema, vaccinationSchema, LIFE_STAGE_LABEL, type LifeStage, gramsToKgInput, parseKgToGrams } from "@tinypet/shared";
import { usePetMutation, usePetResource, type Pet } from "@/hooks/use-pets";
import { Badge, Button, Empty, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { fmtWeight, toDateKey, fmtDay } from "@/lib/format";
import { WeightChart, type StageBand } from "./weight-chart";
import { cn } from "@/lib/utils";

type VacInput = z.infer<typeof vaccinationSchema>;
type MeasInput = z.infer<typeof bodyMeasurementSchema>;
type Vac = { id: string; kind: "VACCINE" | "DEWORMING"; name: string; appliedAt: string; nextDueAt: string | null; notes: string | null; partner?: { tradeName: string } | null; measurement?: { id: string; weightG: number } | null };

type Meas = { id: string; measuredAt: string; weightG: number; heightCm: number | string | null; lengthCm: number | string | null; neckCm: number | string | null; chestCm: number | string | null; abdomenCm: number | string | null; bodyScore: number | null; notes: string | null; vetVerified: boolean; partnerId: string | null; userId: string | null };
type MeasData = { items: Meas[]; lifeStage: LifeStage | null; reference?: { minG: number; maxG: number } | null; alerts?: { type?: string; message: string }[]; bands?: StageBand[] };

/** `readOnly` (shared account): vaccinations and measurements are listed without add/edit/delete. */
export function PetHealth({ pet, readOnly = false }: { pet: Pet; readOnly?: boolean }) {
  return (
    <div className="space-y-8">
      <Vaccinations petId={pet.id} deceased={pet.status === "DECEASED" || readOnly} />
      <Measurements pet={pet} readOnly={readOnly} />
    </div>
  );
}

function Vaccinations({ petId, deceased }: { petId: string; deceased: boolean }) {
  const q = usePetResource<Vac[]>(petId, "vaccinations");
  // The optional weight becomes a measurement: refresh the weight chart too.
  const create = usePetMutation<VacInput>(petId, "vaccinations", "POST", ["vaccinations", "measurements"]);
  const update = usePetMutation<VacInput>(petId, "vaccinations", "PATCH", ["vaccinations", "measurements"]);
  const [weightKg, setWeightKg] = useState("");
  const weightG = parseKgToGrams(weightKg);
  const remove = usePetMutation(petId, "vaccinations", "DELETE");
  const { toast } = useToast();
  const [editing, setEditing] = useState<Vac | null | "new">(null);
  const [del, setDel] = useState<Vac | null>(null);
  const form = useForm<VacInput>({ resolver: zodResolver(vaccinationSchema), defaultValues: { kind: "VACCINE", appliedAt: toDateKey() } });

  function openNew() {
    form.reset({ kind: "VACCINE", name: "", appliedAt: toDateKey(), nextDueAt: null, notes: null });
    setWeightKg("");
    setEditing("new");
  }
  function openEdit(v: Vac) {
    form.reset({ kind: v.kind, name: v.name, appliedAt: v.appliedAt.slice(0, 10), nextDueAt: v.nextDueAt?.slice(0, 10) ?? null, notes: v.notes });
    setWeightKg(gramsToKgInput(v.measurement?.weightG));
    setEditing(v);
  }
  async function submit(v: VacInput) {
    if (weightG === undefined) return;
    try {
      if (editing === "new") await create.mutateAsync({ body: { ...v, weightG: weightG ?? undefined } });
      // on edit, an emptied field (null) removes the weight recorded with the dose
      else if (editing) await update.mutateAsync({ path: `/${editing.id}`, body: { ...v, weightG: weightG ?? (editing.measurement ? null : undefined) } });
      toast("Registro salvo.", "success");
      setEditing(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  const items = [...(q.data ?? [])].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  const today = toDateKey();
  return (
    <section aria-labelledby="vacinas">
      <div className="mb-3 flex items-center justify-between">
        <h3 id="vacinas" className="inline-flex items-center gap-2 font-semibold">
          <Syringe className="h-4 w-4" aria-hidden /> Carteira de vacinação e vermífugos
        </h3>
        {!deceased && (
          <Button type="button" variant="secondary" onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden /> Registrar
          </Button>
        )}
      </div>
      {q.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty title="Nenhuma dose registrada" description="Registre vacinas e vermífugos para receber lembretes da próxima dose." />
      ) : (
        <ul className="divide-y rounded-2xl border">
          {items.map((v) => {
            const overdue = v.nextDueAt && v.nextDueAt.slice(0, 10) < today;
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <Badge tone={v.kind === "VACCINE" ? "green" : "amber"}>{v.kind === "VACCINE" ? "Vacina" : "Vermífugo"}</Badge>
                <span className="flex-1 font-medium">{v.name}</span>
                <span className="text-xs text-[var(--muted)]">Aplicada em {fmtDay(v.appliedAt)}</span>
                {v.nextDueAt && <span className={cn("text-xs", overdue ? "font-semibold text-red-600" : "text-[var(--muted)]")}>Próxima: {fmtDay(v.nextDueAt)}{overdue ? " (atrasada)" : ""}</span>}
                {v.measurement && <span className="text-xs text-[var(--muted)]">Peso: {fmtWeight(v.measurement.weightG)}</span>}
                {v.partner?.tradeName && <span className="text-xs text-[var(--muted)]">{v.partner.tradeName}</span>}
                {!deceased && (
                  <span className="flex gap-1">
                    <button type="button" onClick={() => openEdit(v)} className="btn-ghost h-8 w-8 px-0" aria-label={`Editar ${v.name}`}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => setDel(v)} className="btn-ghost h-8 w-8 px-0 text-red-600" aria-label={`Excluir ${v.name}`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Registrar dose" : "Editar dose"}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-3" noValidate>
          <Select id="v-kind" label="Tipo" {...form.register("kind")}>
            <option value="VACCINE">Vacina</option>
            <option value="DEWORMING">Vermífugo</option>
          </Select>
          <Input id="v-name" label="Nome (ex.: V10, antirrábica)" {...form.register("name")} error={form.formState.errors.name?.message} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="v-applied" type="date" label="Aplicada em" max={today} {...form.register("appliedAt")} error={form.formState.errors.appliedAt?.message} />
            <Input id="v-next" type="date" label="Próxima dose" {...form.register("nextDueAt", { setValueAs: (v) => v || null })} error={form.formState.errors.nextDueAt?.message} />
          </div>
          <Input
            id="v-weight"
            label="Peso do pet (kg) — opcional"
            inputMode="decimal"
            placeholder="ex.: 8,5"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            error={weightG === undefined ? "Informe o peso em kg (ex.: 8,5)" : undefined}
          />
          <p className="-mt-2 text-xs text-[var(--muted)]">Se informado, entra no histórico de peso do pet na data da aplicação.</p>
          <Textarea id="v-notes" label="Observações" {...form.register("notes", { setValueAs: (v) => v || null })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Excluir registro?" description={del ? `${del.name} de ${fmtDay(del.appliedAt)} será removida.` : ""} confirmLabel="Excluir" danger loading={remove.isPending} onConfirm={() => del && remove.mutateAsync({ path: `/${del.id}` }).then(() => setDel(null)).catch((e) => toast(errorMessage(e), "error"))} />
    </section>
  );
}

const PERIODS = [["6m", "6 meses"], ["1y", "1 ano"], ["all", "Vida toda"]] as const;

function Measurements({ pet, readOnly = false }: { pet: Pet; readOnly?: boolean }) {
  const [period, setPeriod] = useState<"6m" | "1y" | "all">("1y");
  const q = usePetResource<MeasData | Meas[]>(pet.id, "measurements", `?period=${period}`);
  const create = usePetMutation<MeasInput>(pet.id, "measurements");
  const update = usePetMutation<MeasInput>(pet.id, "measurements", "PATCH");
  const remove = usePetMutation(pet.id, "measurements", "DELETE");
  const { toast } = useToast();
  const [editing, setEditing] = useState<Meas | null | "new">(null);
  const [del, setDel] = useState<Meas | null>(null);
  const form = useForm<MeasInput>({ resolver: zodResolver(bodyMeasurementSchema), defaultValues: { measuredAt: toDateKey() } });
  const deceased = pet.status === "DECEASED" || readOnly;

  const data: MeasData = Array.isArray(q.data) ? { items: q.data, lifeStage: null } : q.data ?? { items: [], lifeStage: null };
  const items = [...(data.items ?? [])].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

  function openNew() {
    form.reset({ measuredAt: toDateKey(), weightG: undefined as unknown as number, heightCm: null, lengthCm: null, neckCm: null, chestCm: null, abdomenCm: null, bodyScore: null, notes: null });
    setEditing("new");
  }
  function openEdit(m: Meas) {
    form.reset({ measuredAt: m.measuredAt.slice(0, 10), weightG: m.weightG, heightCm: numOrNull(m.heightCm), lengthCm: numOrNull(m.lengthCm), neckCm: numOrNull(m.neckCm), chestCm: numOrNull(m.chestCm), abdomenCm: numOrNull(m.abdomenCm), bodyScore: m.bodyScore, notes: m.notes });
    setEditing(m);
  }
  async function submit(v: MeasInput) {
    try {
      if (editing === "new") await create.mutateAsync({ body: v });
      else if (editing) await update.mutateAsync({ path: `/${editing.id}`, body: v });
      toast("Medida salva.", "success");
      setEditing(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <section aria-labelledby="medidas">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="medidas" className="font-semibold">
          Peso e medidas {data.lifeStage && <Badge tone="brand" className="ml-2">{LIFE_STAGE_LABEL[data.lifeStage]}</Badge>}
        </h3>
        <div className="flex flex-wrap gap-2">
          <div role="radiogroup" aria-label="Período" className="inline-flex rounded-xl border p-0.5">
            {PERIODS.map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={period === k} onClick={() => setPeriod(k)} className={cn("rounded-lg px-3 py-1 text-xs", period === k ? "bg-brand-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
                {l}
              </button>
            ))}
          </div>
          <a href={`/api/v1/pets/${pet.id}/measurements/export`} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-3 text-xs">
            <Download className="h-3.5 w-3.5" aria-hidden /> PDF
          </a>
          {!deceased && (
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Registrar
            </Button>
          )}
        </div>
      </div>
      {(data.alerts ?? []).map((a, i) => (
        <p key={i} role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {a.message}
        </p>
      ))}
      {q.isLoading ? (
        <Spinner />
      ) : (
        <div className="card">
          <WeightChart points={data.items ?? []} bands={data.bands ?? []} reference={data.reference ?? null} />
        </div>
      )}
      {items.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs text-[var(--muted)] dark:bg-ink-800/60">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Peso</th>
                <th className="hidden px-3 py-2 sm:table-cell">Altura</th>
                <th className="hidden px-3 py-2 sm:table-cell">Pescoço</th>
                <th className="hidden px-3 py-2 sm:table-cell">Tórax</th>
                <th className="hidden px-3 py-2 md:table-cell">ECC</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2">{fmtDay(m.measuredAt)}</td>
                  <td className="px-3 py-2 font-medium">{fmtWeight(m.weightG)}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{m.heightCm != null ? `${m.heightCm} cm` : "—"}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{m.neckCm != null ? `${m.neckCm} cm` : "—"}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{m.chestCm != null ? `${m.chestCm} cm` : "—"}</td>
                  <td className="hidden px-3 py-2 md:table-cell">{m.bodyScore ?? "—"}</td>
                  <td className="px-3 py-2">
                    {m.vetVerified ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Veterinário
                      </span>
                    ) : m.partnerId ? (
                      <span className="text-xs text-[var(--muted)]">Parceiro</span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">Tutor</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!m.partnerId && !deceased && (
                      <span className="inline-flex gap-1">
                        <button type="button" onClick={() => openEdit(m)} className="btn-ghost h-8 w-8 px-0" aria-label="Editar medida">
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" onClick={() => setDel(m)} className="btn-ghost h-8 w-8 px-0 text-red-600" aria-label="Excluir medida">
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Registrar peso e medidas" : "Editar medida"}>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2" noValidate>
          <Input id="m-date" type="date" label="Data" max={toDateKey()} {...form.register("measuredAt")} error={form.formState.errors.measuredAt?.message} />
          <Input id="m-weight" type="number" min={1} label="Peso (g)" placeholder="ex.: 8500" {...form.register("weightG")} error={form.formState.errors.weightG?.message} />
          <Input id="m-height" type="number" step="0.1" label="Altura na cernelha (cm)" {...form.register("heightCm", { setValueAs: numOrNull })} />
          <Input id="m-length" type="number" step="0.1" label="Comprimento (cm)" {...form.register("lengthCm", { setValueAs: numOrNull })} />
          <Input id="m-neck" type="number" step="0.1" label="Pescoço (cm)" {...form.register("neckCm", { setValueAs: numOrNull })} />
          <Input id="m-chest" type="number" step="0.1" label="Tórax (cm)" {...form.register("chestCm", { setValueAs: numOrNull })} />
          <Input id="m-abd" type="number" step="0.1" label="Abdômen (cm)" {...form.register("abdomenCm", { setValueAs: numOrNull })} />
          <Select id="m-score" label="Escore corporal (1–9)" {...form.register("bodyScore", { setValueAs: numOrNull })}>
            <option value="">—</option>
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <Textarea id="m-notes" label="Observações" {...form.register("notes", { setValueAs: (v) => v || null })} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Excluir medida?" description={del ? `Registro de ${fmtDay(del.measuredAt)} (${fmtWeight(del.weightG)}).` : ""} confirmLabel="Excluir" danger loading={remove.isPending} onConfirm={() => del && remove.mutateAsync({ path: `/${del.id}` }).then(() => setDel(null)).catch((e) => toast(errorMessage(e), "error"))} />
    </section>
  );
}
