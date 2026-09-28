"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { historyEventSchema } from "@tinypet/shared";
import { z } from "zod";
import { Activity, Award, FileText, Paperclip, Plus, Scale, Stethoscope, Syringe, Star, Flag, X } from "lucide-react";
import { Button, Input, Modal, Select, Spinner, Textarea, Empty } from "@/components/ui";
import { ErrorBox } from "@/components/painel/ui";
import { UploadButton } from "@/components/media/UploadButton";
import { useApiMutation, usePetHistory } from "@/hooks/use-crm";
import { fmtDateTime, localToISO, isoToLocal } from "@/lib/format";

type HistoryInput = z.infer<typeof historyEventSchema>;
const TYPES: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  VISIT: { label: "Atendimento", icon: Stethoscope },
  VACCINE: { label: "Vacina", icon: Syringe },
  DEWORMING: { label: "Vermífugo", icon: Syringe },
  WEIGHT: { label: "Peso", icon: Scale },
  ACHIEVEMENT: { label: "Conquista", icon: Award },
  MILESTONE: { label: "Marco", icon: Flag },
  SKILL: { label: "Comando", icon: Star },
  NOTE: { label: "Nota", icon: FileText },
  ATTACHMENT: { label: "Anexo", icon: Paperclip },
  BADGE: { label: "Badge", icon: Award },
  APPOINTMENT: { label: "Atendimento", icon: Stethoscope },
  MEASUREMENT: { label: "Medida", icon: Scale },
};

export function HistoryTab({ petId, partnerId }: { petId: string; partnerId: string | null }) {
  const q = usePetHistory(petId);
  const [open, setOpen] = useState(false);
  const create = useApiMutation<HistoryInput>({ path: () => `/pets/${petId}/history`, body: (v) => v, invalidate: [["pet", petId, "history"]], success: "Registro adicionado", onSuccess: () => setOpen(false) });
  const items = q.data ?? [];
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Registrar atendimento/anexo
        </Button>
      </div>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <Empty title="Sem histórico ainda" description="Atendimentos concluídos, vacinas, medidas e anexos aparecem aqui." />
      ) : (
        <ol className="relative ml-3 border-l pl-6">
          {items.map((ev) => {
            const meta = TYPES[ev.type] ?? { label: ev.type, icon: Activity };
            const Icon = meta.icon;
            return (
              <li key={ev.id} className="relative mb-6">
                <span className="absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full border bg-[var(--card)]" aria-hidden>
                  <Icon className="h-3.5 w-3.5 text-brand-500" />
                </span>
                <div className="card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{ev.title}</p>
                    <span className="text-xs text-[var(--muted)]">{fmtDateTime(ev.occurredAt)}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {meta.label}
                    {ev.partner?.tradeName ? ` · ${ev.partner.tradeName}` : ""}
                  </p>
                  {ev.description && <p className="mt-2 whitespace-pre-line text-sm">{ev.description}</p>}
                  {!!ev.attachments?.length && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {ev.attachments.map((a, i) => (
                        <li key={i}>
                          {a.type?.startsWith("image") ? (
                            <a href={a.url} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded-lg border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                            </a>
                          ) : (
                            <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-ink-100 dark:hover:bg-ink-800">
                              <Paperclip className="h-3 w-3" aria-hidden /> {a.name}
                            </a>
                          )}
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
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar no histórico">
        {open && <HistoryForm partnerId={partnerId} submitting={create.isPending} onSubmit={(v) => create.mutate(v)} onCancel={() => setOpen(false)} />}
      </Modal>
    </div>
  );
}

function HistoryForm({ partnerId, onSubmit, onCancel, submitting }: { partnerId: string | null; onSubmit: (v: HistoryInput) => void; onCancel: () => void; submitting?: boolean }) {
  const [attachments, setAttachments] = useState<{ url: string; name: string; type?: string }[]>([]);
  const { register, handleSubmit, formState: { errors } } = useForm<{ type: HistoryInput["type"]; title: string; description: string; occurredAt: string }>({
    resolver: zodResolver(z.object({ type: historyEventSchema.shape.type, title: z.string().min(1, "Informe o título"), description: z.string(), occurredAt: z.string().min(1, "Informe a data") })),
    defaultValues: { type: "VISIT", title: "", description: "", occurredAt: isoToLocal(new Date().toISOString()) },
  });
  return (
    <form noValidate className="space-y-3" onSubmit={handleSubmit((v) => onSubmit({ type: v.type, title: v.title, description: v.description || null, occurredAt: localToISO(v.occurredAt), attachments }))}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select id="h-type" label="Tipo" {...register("type")}>
          {["VISIT", "NOTE", "ATTACHMENT", "VACCINE", "DEWORMING", "MILESTONE", "ACHIEVEMENT"].map((k) => (
            <option key={k} value={k}>
              {TYPES[k]?.label}
            </option>
          ))}
        </Select>
        <Input id="h-date" type="datetime-local" label="Quando" {...register("occurredAt")} error={errors.occurredAt?.message} />
      </div>
      <Input id="h-title" label="Título" {...register("title")} error={errors.title?.message} />
      <Textarea id="h-desc" label="Descrição / relato" {...register("description")} />
      <div>
        <span className="label">Anexos (imagens ou PDF)</span>
        <ul className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <li key={i} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs">
              <Paperclip className="h-3 w-3" aria-hidden /> {a.name}
              <button type="button" aria-label={`Remover ${a.name}`} onClick={() => setAttachments((s) => s.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
        <UploadButton purpose="ATTACHMENT" partnerId={partnerId} accept="image/*,application/pdf" multiple label="Anexar arquivo" onUploaded={(m, f) => setAttachments((s) => [...s, { url: m.url, name: f.name, type: f.type }])} />
      </div>
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
