"use client";
import { useState } from "react";
import { Check, CloudRain, ListChecks, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { usePetMutation, usePetResource } from "@/hooks/use-pets";
import { Badge, Button, Empty, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { WEEKDAYS_SHORT, fmtDateTime, toDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";

type Rule = { freq: "daily" | "weekly" | "monthly"; days?: number[]; dayOfMonth?: number; times?: string[] } | null;
type Task = { id: string; title: string; description: string | null; rule: Rule; dueAt: string | null; status: "PROPOSED" | "ACTIVE" | "PAUSED" | "DONE"; proposedByPartner?: { tradeName: string } | null; doneToday?: boolean; completedToday?: boolean; skippedToday?: boolean; skipNote?: string | null; dueToday?: boolean };

/** One-tap reasons for "não deu hoje". */
const SKIP_REASONS = ["Estava chovendo", "Tive um compromisso", "Pet indisposto", "Viagem", "Consulta veterinária"];
type Template = { id?: string; key?: string; title: string; description?: string | null; rule?: Rule };

function ruleText(r: Rule): string {
  if (!r) return "Avulsa";
  const times = r.times?.length ? ` às ${r.times.join(", ")}` : "";
  if (r.freq === "daily") return `Todo dia${times}`;
  if (r.freq === "monthly") return `Todo mês${r.dayOfMonth ? `, dia ${r.dayOfMonth}` : ""}${times}`;
  const days = (r.days ?? []).map((d) => WEEKDAYS_SHORT[d]).join(", ");
  return `Semanal (${days || "—"})${times}`;
}

/** ISO → value for <input type="datetime-local"> in the browser's timezone. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `readOnly` (shared account): only the "done" checkbox works; creating/editing/accepting tasks is owner-only. */
export function PetRoutine({ petId, deceased, readOnly = false }: { petId: string; deceased: boolean; readOnly?: boolean }) {
  // API: { date, tasks[], today[{ id, completed }] } (older servers returned Task[])
  const q = usePetResource<Task[] | { tasks: Task[]; today?: { id: string; completed?: boolean; skipped?: boolean; skipNote?: string | null }[] }>(petId, "tasks");
  const templates = usePetResource<Template[]>(petId, "tasks/templates");
  const create = usePetMutation<Record<string, unknown>>(petId, "tasks");
  const patch = usePetMutation<Record<string, unknown>>(petId, "tasks", "PATCH");
  const remove = usePetMutation(petId, "tasks", "DELETE");
  const complete = usePetMutation<{ forDate: string }>(petId, "tasks");
  const accept = usePetMutation(petId, "tasks");
  const skip = usePetMutation<{ note: string; forDate: string }>(petId, "tasks");
  const unskip = usePetMutation(petId, "tasks", "DELETE");
  const [skipping, setSkipping] = useState<Task | null>(null);
  const [skipNote, setSkipNote] = useState("");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  // null = creating; otherwise the task being edited
  const [editing, setEditing] = useState<Task | null>(null);
  const emptyForm = { title: "", description: "", freq: "daily" as const, days: [] as number[], dayOfMonth: "", times: "08:00", dueAt: "" };
  const [form, setForm] = useState<{ title: string; description: string; freq: "none" | "daily" | "weekly" | "monthly"; days: number[]; dayOfMonth: string; times: string; dueAt: string }>(emptyForm);
  const closeModal = () => {
    setOpen(false);
    setEditing(null);
  };

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <Empty title="Não foi possível carregar a rotina" description={errorMessage(q.error)} />;
  const raw = q.data ?? [];
  const todayRows = new Map((Array.isArray(raw) ? [] : raw.today ?? []).map((t) => [t.id, t]));
  const tasks = (Array.isArray(raw) ? raw : raw.tasks ?? []).map((t) => {
    const d = todayRows.get(t.id);
    return d ? { ...t, dueToday: true, doneToday: !!d.completed, skippedToday: !!d.skipped, skipNote: d.skipNote ?? null } : t;
  });

  async function submitSkip() {
    if (!skipping || skipNote.trim().length < 2) return;
    try {
      await skip.mutateAsync({ path: `/${skipping.id}/skip`, body: { note: skipNote.trim(), forDate: toDateKey() } });
      toast("Registrado: não foi feita hoje. A sequência de dias não é perdida.", "success");
      setSkipping(null);
      setSkipNote("");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  const proposed = tasks.filter((t) => t.status === "PROPOSED");
  const active = tasks.filter((t) => t.status !== "PROPOSED");

  function applyTemplate(t: Template) {
    setEditing(null);
    setForm({ title: t.title, description: t.description ?? "", freq: t.rule?.freq ?? "daily", days: t.rule?.days ?? [], dayOfMonth: t.rule?.dayOfMonth ? String(t.rule.dayOfMonth) : "", times: (t.rule?.times ?? ["08:00"]).join(", "), dueAt: "" });
    setOpen(true);
  }
  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? "",
      freq: t.rule?.freq ?? "none",
      days: t.rule?.days ?? [],
      dayOfMonth: t.rule?.dayOfMonth ? String(t.rule.dayOfMonth) : "",
      times: (t.rule?.times ?? (t.rule ? ["08:00"] : [])).join(", "),
      dueAt: t.dueAt ? toLocalInput(t.dueAt) : "",
    });
    setOpen(true);
  }
  async function submit() {
    const times = form.times.split(",").map((s) => s.trim()).filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s));
    const dom = Number(form.dayOfMonth);
    const rule =
      form.freq === "none"
        ? null
        : { freq: form.freq, days: form.freq === "weekly" ? form.days : undefined, dayOfMonth: form.freq === "monthly" && dom >= 1 && dom <= 31 ? dom : undefined, times: times.length ? times : undefined };
    const body = { title: form.title, description: form.description || null, rule, dueAt: form.freq === "none" && form.dueAt ? new Date(form.dueAt).toISOString() : null };
    try {
      if (editing) await patch.mutateAsync({ path: `/${editing.id}`, body });
      else await create.mutateAsync({ body });
      toast(editing ? "Tarefa atualizada." : "Tarefa criada.", "success");
      closeModal();
      setForm(emptyForm);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <div className="space-y-6">
      {!deceased && !readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(templates.data ?? []).slice(0, 8).map((t) => (
              <button key={t.id ?? t.key ?? t.title} type="button" onClick={() => applyTemplate(t)} className="rounded-full border px-3 py-1 text-xs hover:bg-ink-100 dark:hover:bg-ink-800">
                + {t.title}
              </button>
            ))}
          </div>
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Nova tarefa
          </Button>
        </div>
      )}
      {proposed.length > 0 && !readOnly && (
        <section aria-labelledby="propostas" className="rounded-2xl border border-brand-300 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-900/20">
          <h3 id="propostas" className="text-sm font-semibold">
            Rotinas propostas por parceiros
          </h3>
          <ul className="mt-2 space-y-2">
            {proposed.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1">
                  <strong>{t.title}</strong> · {ruleText(t.rule)}
                  {t.proposedByPartner?.tradeName && <span className="text-[var(--muted)]"> · {t.proposedByPartner.tradeName}</span>}
                </span>
                <Button type="button" className="h-8 px-3 text-xs" onClick={() => accept.mutateAsync({ path: `/${t.id}/accept` }).then(() => toast("Rotina aceita!", "success")).catch((e) => toast(errorMessage(e), "error"))}>
                  Aceitar
                </Button>
                <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={() => remove.mutateAsync({ path: `/${t.id}` }).catch((e) => toast(errorMessage(e), "error"))}>
                  Recusar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {active.length === 0 ? (
        <Empty title="Sem tarefas ainda" description="Crie passeios, remédios e outras rotinas. Use os modelos para começar rápido." />
      ) : (
        <ul className="divide-y rounded-2xl border">
          {active.map((t) => {
            const done = !!(t.doneToday ?? t.completedToday);
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button type="button" disabled={deceased || done || t.status === "PAUSED"} onClick={() => complete.mutateAsync({ path: `/${t.id}/complete`, body: { forDate: toDateKey() } }).then(() => toast("Feito!", "success")).catch((e) => toast(errorMessage(e), "error"))} aria-label={done ? `${t.title} concluída hoje` : `Concluir ${t.title} hoje`} className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full border-2", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-ink-300 hover:border-brand-500 dark:border-ink-600")}>
                  {done ? <Check className="h-4 w-4" aria-hidden /> : <ListChecks className="h-4 w-4 opacity-0" aria-hidden />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", done && "text-[var(--muted)] line-through")}>{t.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {ruleText(t.rule)}
                    {t.dueAt ? ` · até ${fmtDateTime(t.dueAt)}` : ""}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                  {t.skippedToday && (
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                      Não feita hoje: {t.skipNote}
                    </p>
                  )}
                </div>
                {t.status === "PAUSED" && <Badge tone="amber">Pausada</Badge>}
                {t.skippedToday && !deceased && (
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs" loading={unskip.isPending} onClick={() => unskip.mutateAsync({ path: `/${t.id}/skip?forDate=${toDateKey()}` }).catch((e) => toast(errorMessage(e), "error"))}>
                    <Undo2 className="h-3.5 w-3.5" aria-hidden /> Desfazer
                  </Button>
                )}
                {t.dueToday && !done && !t.skippedToday && !deceased && t.status === "ACTIVE" && (
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setSkipping(t); setSkipNote(""); }}>
                    <CloudRain className="h-3.5 w-3.5" aria-hidden /> Não deu hoje
                  </Button>
                )}
                {!deceased && !readOnly && (
                  <span className="flex gap-1">
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => patch.mutateAsync({ path: `/${t.id}`, body: { status: t.status === "PAUSED" ? "ACTIVE" : "PAUSED" } }).catch((e) => toast(errorMessage(e), "error"))}>
                      {t.status === "PAUSED" ? "Retomar" : "Pausar"}
                    </Button>
                    <button type="button" onClick={() => openEdit(t)} className="btn-ghost h-8 w-8 px-0" aria-label={`Editar ${t.title}`}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => remove.mutateAsync({ path: `/${t.id}` }).catch((e) => toast(errorMessage(e), "error"))} className="btn-ghost h-8 w-8 px-0 text-red-600" aria-label={`Excluir ${t.title}`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={!!skipping} onClose={() => setSkipping(null)} title="Não deu para fazer hoje?">
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            <strong className="text-[var(--fg)]">{skipping?.title}</strong> — conte o motivo. Um dia justificado não zera a sequência de dias de rotina do pet (mas também não soma).
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Motivos comuns">
            {SKIP_REASONS.map((r) => (
              <button key={r} type="button" aria-pressed={skipNote === r} onClick={() => setSkipNote(r)} className={cn("rounded-full border px-3 py-1 text-xs", skipNote === r ? "border-brand-500 bg-brand-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
                {r}
              </button>
            ))}
          </div>
          <Textarea id="skip-note" label="Motivo" value={skipNote} onChange={(e) => setSkipNote(e.target.value)} maxLength={500} placeholder="Ex.: estava chovendo muito" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSkipping(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitSkip} disabled={skipNote.trim().length < 2} loading={skip.isPending}>
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
      <Modal open={open} onClose={closeModal} title={editing ? "Editar tarefa" : "Nova tarefa"}>
        <div className="space-y-3">
          <Input id="t-title" label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Passeio da manhã" />
          <Textarea id="t-desc" label="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select id="t-freq" label="Frequência" value={form.freq} onChange={(e) => setForm({ ...form, freq: e.target.value as typeof form.freq })}>
            <option value="daily">Todo dia</option>
            <option value="weekly">Dias da semana</option>
            <option value="monthly">Todo mês</option>
            <option value="none">Avulsa</option>
          </Select>
          {form.freq === "monthly" && (
            <Input id="t-dom" type="number" min={1} max={31} label="Dia do mês" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} placeholder="Ex.: 10 (em meses mais curtos, vale o último dia)" />
          )}
          {form.freq === "weekly" && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
              {WEEKDAYS_SHORT.map((d, i) => (
                <button key={d} type="button" aria-pressed={form.days.includes(i)} onClick={() => setForm({ ...form, days: form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i].sort() })} className={cn("rounded-full border px-3 py-1 text-xs", form.days.includes(i) ? "border-brand-500 bg-brand-500 text-white" : "")}>
                  {d}
                </button>
              ))}
            </div>
          )}
          {form.freq !== "none" ? (
            <Input id="t-times" label="Horários (HH:MM, separados por vírgula)" value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} placeholder="08:00, 18:00" />
          ) : (
            <Input id="t-due" type="datetime-local" label="Prazo" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="button" onClick={submit} disabled={!form.title.trim() || (form.freq === "weekly" && form.days.length === 0)} loading={create.isPending || patch.isPending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
