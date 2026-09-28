"use client";
import { useState } from "react";
import { Award, Camera, FileText, Flag, Paperclip, Scale, Stethoscope, Syringe, Bug, Sparkles, Plus } from "lucide-react";
import { usePetMutation, usePetResource } from "@/hooks/use-pets";
import { fmtDateTime, toDateKey } from "@/lib/format";
import { Button, Empty, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { safeHref } from "@tinypet/shared";

type Ev = { id: string; type: string; title: string; description: string | null; occurredAt: string; partner?: { tradeName: string } | null; user?: { name: string } | null; attachments?: { url: string; name: string; type?: string }[] | null; photos?: string[] | null };

const ICON: Record<string, { icon: typeof Award; color: string; label: string }> = {
  VISIT: { icon: Stethoscope, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200", label: "Visita" },
  VACCINE: { icon: Syringe, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200", label: "Vacina" },
  DEWORMING: { icon: Bug, color: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200", label: "Vermífugo" },
  WEIGHT: { icon: Scale, color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200", label: "Pesagem" },
  ACHIEVEMENT: { icon: Award, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200", label: "Conquista" },
  MILESTONE: { icon: Camera, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-200", label: "Marco" },
  SKILL: { icon: Sparkles, color: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200", label: "Comando" },
  NOTE: { icon: FileText, color: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200", label: "Anotação" },
  ATTACHMENT: { icon: Paperclip, color: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200", label: "Anexo" },
};

export function PetHistory({ petId, deceased }: { petId: string; deceased: boolean }) {
  const q = usePetResource<Ev[]>(petId, "history");
  const create = usePetMutation<Record<string, unknown>>(petId, "history");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "NOTE", title: "", description: "", date: toDateKey() });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <Empty title="Não foi possível carregar o histórico" description={errorMessage(q.error)} />;
  const items = q.data ?? [];
  return (
    <div className="space-y-4">
      {!deceased && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Anotação
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <Empty title="Linha do tempo vazia" description="Visitas concluídas, vacinas, pesagens e conquistas aparecem aqui." />
      ) : (
        <ol className="relative ml-4 border-l">
          {items.map((e) => {
            const meta = ICON[e.type] ?? { icon: Flag, color: ICON.NOTE!.color, label: e.type };
            const Icon = meta.icon;
            return (
              <li key={e.id} className="mb-6 ml-6">
                <span className={`absolute -left-4 inline-flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-[var(--bg)] ${meta.color}`}>
                  <Icon className="h-4 w-4" aria-label={meta.label} />
                </span>
                <div className="card">
                  <p className="text-xs text-[var(--muted)]">
                    {fmtDateTime(e.occurredAt)}
                    {e.partner?.tradeName ? ` · ${e.partner.tradeName}` : e.user?.name ? ` · ${e.user.name}` : ""}
                  </p>
                  <p className="mt-0.5 font-medium">{e.title}</p>
                  {e.description && <p className="mt-1 whitespace-pre-line text-sm text-[var(--muted)]">{e.description}</p>}
                  {e.photos && e.photos.length > 0 && (
                    <ul className="mt-2 flex gap-2 overflow-x-auto">
                      {e.photos.map((p) => (
                        <li key={p}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={safeHref(p)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                        </li>
                      ))}
                    </ul>
                  )}
                  {e.attachments && e.attachments.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {e.attachments.map((a) => (
                        <li key={a.url}>
                          <a href={safeHref(a.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                            <Paperclip className="h-3 w-3" aria-hidden /> {a.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nova anotação">
        <div className="space-y-3">
          <Select id="h-type" label="Tipo" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="NOTE">Anotação</option>
            <option value="MILESTONE">Marco</option>
            <option value="VISIT">Visita</option>
          </Select>
          <Input id="h-title" label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea id="h-desc" label="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input id="h-date" type="date" label="Data" value={form.date} max={toDateKey()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!form.title}
              loading={create.isPending}
              onClick={() =>
                create
                  .mutateAsync({ body: { type: form.type, title: form.title, description: form.description || null, occurredAt: new Date(`${form.date}T12:00:00`).toISOString() } })
                  .then(() => {
                    setOpen(false);
                    setForm({ type: "NOTE", title: "", description: "", date: toDateKey() });
                    toast("Anotação salva.", "success");
                  })
                  .catch((e) => toast(errorMessage(e), "error"))
              }
            >
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
