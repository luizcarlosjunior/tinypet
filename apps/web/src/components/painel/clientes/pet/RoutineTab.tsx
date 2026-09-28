"use client";
import { useState } from "react";
import { Plus, Send, X } from "lucide-react";
import { Badge, Button, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { ChipSelect, ErrorBox } from "@/components/painel/ui";
import { useApiMutation, usePetTasks } from "@/hooks/use-crm";
import { WEEKDAYS_SHORT, fmtDate } from "@/lib/format";
import { timeString } from "@tinypet/shared";

const STATUS: Record<string, { label: string; tone: "amber" | "green" | "gray" | "blue" | "red" }> = { PROPOSED: { label: "Aguardando aceite", tone: "amber" }, ACTIVE: { label: "Ativa", tone: "green" }, PAUSED: { label: "Pausada", tone: "gray" }, DONE: { label: "Concluída", tone: "blue" }, COMPLETED: { label: "Concluída", tone: "blue" }, CANCELED: { label: "Cancelada", tone: "red" } };
const DAYS = WEEKDAYS_SHORT.map((d, i) => ({ key: String(i), label: d }));

export function RoutineTab({ petId }: { petId: string }) {
  const q = usePetTasks(petId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [freq, setFreq] = useState<"daily" | "weekly">("daily");
  const [days, setDays] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>(["09:00"]);
  const [timeDraft, setTimeDraft] = useState("");
  const create = useApiMutation<unknown>({
    path: () => `/pets/${petId}/tasks`,
    body: (v) => v,
    invalidate: [["pet", petId, "tasks"]],
    success: "Rotina enviada ao tutor",
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setDescription("");
      setDays([]);
      setTimes(["09:00"]);
    },
  });
  const items = q.data ?? [];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">Rotinas enviadas por você ficam como proposta até o tutor aceitar no app.</p>
        <Button type="button" onClick={() => setOpen(true)}>
          <Send className="h-4 w-4" aria-hidden /> Enviar rotina
        </Button>
      </div>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <p className="card text-sm text-[var(--muted)]">Nenhuma tarefa na rotina deste pet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((t) => (
            <li key={t.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{t.title}</p>
                <Badge tone={STATUS[t.status]?.tone ?? "gray"}>{STATUS[t.status]?.label ?? t.status}</Badge>
              </div>
              {t.description && <p className="mt-1 text-sm text-[var(--muted)]">{t.description}</p>}
              <p className="mt-2 text-xs text-[var(--muted)]">
                {t.rule ? (t.rule.freq === "daily" ? "Todo dia" : `Semanal: ${(t.rule.days ?? []).map((d) => WEEKDAYS_SHORT[d]).join(", ")}`) : t.dueAt ? `Até ${fmtDate(t.dueAt)}` : "Sem recorrência"}
                {t.rule?.times?.length ? ` · ${t.rule.times.join(", ")}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Enviar rotina para o tutor">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            create.mutate({ title: title.trim(), description: description || null, rule: { freq, days: freq === "weekly" ? days.map(Number) : undefined, times: times.length ? times : undefined } });
          }}
        >
          <Input id="tk-title" label="Tarefa" placeholder='ex.: Treinar "senta" 3x' value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Textarea id="tk-desc" label="Instruções" className="min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Select id="tk-freq" label="Frequência" value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)}>
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
          </Select>
          {freq === "weekly" && <ChipSelect label="Dias da semana" options={DAYS} value={days} onChange={setDays} />}
          <div>
            <span className="label">Horários</span>
            <div className="flex flex-wrap items-center gap-2">
              {times.map((t) => (
                <span key={t} className="badge bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-100">
                  {t}
                  <button type="button" className="ml-1" aria-label={`Remover ${t}`} onClick={() => setTimes((s) => s.filter((x) => x !== t))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input type="time" aria-label="Novo horário" className="input h-8 w-auto py-0 text-xs" value={timeDraft} onChange={(e) => setTimeDraft(e.target.value)} />
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  if (timeString.safeParse(timeDraft).success && !times.includes(timeDraft)) setTimes((s) => [...s, timeDraft].sort());
                  setTimeDraft("");
                }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!title.trim() || (freq === "weekly" && days.length === 0)}>
              Enviar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
