"use client";
import { useState } from "react";
import { Check, ListChecks, Plus, Trash2 } from "lucide-react";
import { usePetMutation, usePetResource } from "@/hooks/use-pets";
import { Badge, Button, Empty, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { WEEKDAYS_SHORT, fmtDateTime, toDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";

type Rule = { freq: "daily" | "weekly"; days?: number[]; times?: string[] } | null;
type Task = { id: string; title: string; description: string | null; rule: Rule; dueAt: string | null; status: "PROPOSED" | "ACTIVE" | "PAUSED" | "DONE"; proposedByPartner?: { tradeName: string } | null; doneToday?: boolean; completedToday?: boolean };
type Template = { id?: string; key?: string; title: string; description?: string | null; rule?: Rule };

function ruleText(r: Rule): string {
  if (!r) return "Avulsa";
  const times = r.times?.length ? ` às ${r.times.join(", ")}` : "";
  if (r.freq === "daily") return `Todo dia${times}`;
  const days = (r.days ?? []).map((d) => WEEKDAYS_SHORT[d]).join(", ");
  return `Semanal (${days || "—"})${times}`;
}

export function PetRoutine({ petId, deceased }: { petId: string; deceased: boolean }) {
  const q = usePetResource<Task[]>(petId, "tasks");
  const templates = usePetResource<Template[]>(petId, "tasks/templates");
  const create = usePetMutation<Record<string, unknown>>(petId, "tasks");
  const patch = usePetMutation<Record<string, unknown>>(petId, "tasks", "PATCH");
  const remove = usePetMutation(petId, "tasks", "DELETE");
  const complete = usePetMutation<{ forDate: string }>(petId, "tasks");
  const accept = usePetMutation(petId, "tasks");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; freq: "none" | "daily" | "weekly"; days: number[]; times: string; dueAt: string }>({ title: "", description: "", freq: "daily", days: [], times: "08:00", dueAt: "" });

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <Empty title="Não foi possível carregar a rotina" description={errorMessage(q.error)} />;
  const tasks = q.data ?? [];
  const proposed = tasks.filter((t) => t.status === "PROPOSED");
  const active = tasks.filter((t) => t.status !== "PROPOSED");

  function applyTemplate(t: Template) {
    setForm({ title: t.title, description: t.description ?? "", freq: t.rule?.freq ?? "daily", days: t.rule?.days ?? [], times: (t.rule?.times ?? ["08:00"]).join(", "), dueAt: "" });
    setOpen(true);
  }
  async function submit() {
    const times = form.times.split(",").map((s) => s.trim()).filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s));
    const rule = form.freq === "none" ? null : { freq: form.freq, days: form.freq === "weekly" ? form.days : undefined, times: times.length ? times : undefined };
    try {
      await create.mutateAsync({ body: { title: form.title, description: form.description || null, rule, dueAt: form.freq === "none" && form.dueAt ? new Date(form.dueAt).toISOString() : null } });
      toast("Tarefa criada.", "success");
      setOpen(false);
      setForm({ title: "", description: "", freq: "daily", days: [], times: "08:00", dueAt: "" });
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <div className="space-y-6">
      {!deceased && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(templates.data ?? []).slice(0, 8).map((t) => (
              <button key={t.id ?? t.key ?? t.title} type="button" onClick={() => applyTemplate(t)} className="rounded-full border px-3 py-1 text-xs hover:bg-ink-100 dark:hover:bg-ink-800">
                + {t.title}
              </button>
            ))}
          </div>
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Nova tarefa
          </Button>
        </div>
      )}
      {proposed.length > 0 && (
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
                </div>
                {t.status === "PAUSED" && <Badge tone="amber">Pausada</Badge>}
                {!deceased && (
                  <span className="flex gap-1">
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => patch.mutateAsync({ path: `/${t.id}`, body: { status: t.status === "PAUSED" ? "ACTIVE" : "PAUSED" } }).catch((e) => toast(errorMessage(e), "error"))}>
                      {t.status === "PAUSED" ? "Retomar" : "Pausar"}
                    </Button>
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
      <Modal open={open} onClose={() => setOpen(false)} title="Nova tarefa">
        <div className="space-y-3">
          <Input id="t-title" label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Passeio da manhã" />
          <Textarea id="t-desc" label="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select id="t-freq" label="Frequência" value={form.freq} onChange={(e) => setForm({ ...form, freq: e.target.value as typeof form.freq })}>
            <option value="daily">Todo dia</option>
            <option value="weekly">Dias da semana</option>
            <option value="none">Avulsa</option>
          </Select>
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
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={submit} disabled={!form.title.trim()} loading={create.isPending}>
              Criar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
