"use client";
import { useRef, useState } from "react";
import { Image as ImageIcon, Lock, Plus, Trash2, Video } from "lucide-react";
import { usePetMutation, usePetResource } from "@/hooks/use-pets";
import { uploadFile } from "@/lib/upload";
import { errorMessage, planLimitOf } from "@/lib/errors";
import { fmtDate, fmtDateTime, toDateKey } from "@/lib/format";
import { Button, Empty, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { PlanLimitNotice } from "./plan-limit-notice";
import { MEDIA_MAX_BYTES } from "@tinypet/shared";
import type { PlanLimitError } from "@tinypet/shared";
import { cn } from "@/lib/utils";

type Media = { id: string; kind: "IMAGE" | "VIDEO"; url: string; thumbUrl: string | null; title: string | null; description: string | null; notes: string | null; takenAt: string; isStory: boolean; expiresAt: string | null; visibility: string };
const VIS = [["PRIVATE", "Privado"], ["FAMILY", "Família"], ["PARTNERS", "Parceiros vinculados"], ["PUBLIC", "Público"]] as const;

export function PetGallery({ petId, deceased }: { petId: string; deceased: boolean }) {
  const feed = usePetResource<Media[]>(petId, "media");
  const stories = usePetResource<Media[]>(petId, "media", "?story=1");
  const create = usePetMutation<Record<string, unknown>>(petId, "media");
  const remove = usePetMutation(petId, "media", "DELETE");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState<PlanLimitError | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: "", description: "", notes: "", takenAt: toDateKey(), isStory: false, visibility: "PRIVATE" });

  const locked = planLimitOf(feed.error) ?? planLimitOf(stories.error);
  if (feed.isLoading) return <Spinner />;
  if (locked || limit) {
    return (
      <div className="space-y-3">
        <div className="card flex flex-col items-center py-10 text-center">
          <Lock className="h-8 w-8 text-[var(--muted)]" aria-hidden />
          <p className="mt-2 font-medium">Galeria e stories disponíveis no plano Plus</p>
          <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">No plano Free você pode enviar apenas o avatar do pet. Faça upgrade para guardar fotos e vídeos com histórico.</p>
        </div>
        <PlanLimitNotice limit={(locked ?? limit)!} title="Disponível no plano Plus" />
      </div>
    );
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadFile(file, "PET_GALLERY", { onProgress: setProgress });
      await create.mutateAsync({
        body: { kind: up.kind, url: up.url, thumbUrl: up.thumbUrl, title: form.title || null, description: form.description || null, notes: form.notes || null, takenAt: new Date(`${form.takenAt}T12:00:00`).toISOString(), isStory: form.isStory, visibility: form.visibility, sizeBytes: up.sizeBytes },
      });
      toast(form.isStory ? "Story publicado por 24 h." : "Adicionado à galeria!", "success");
      setOpen(false);
      setFile(null);
      setForm({ title: "", description: "", notes: "", takenAt: toDateKey(), isStory: false, visibility: "PRIVATE" });
    } catch (e) {
      const pl = planLimitOf(e);
      if (pl) {
        setLimit(pl);
        setOpen(false);
      } else toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  const items = feed.data ?? [];
  const activeStories = (stories.data ?? []).filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > Date.now());

  return (
    <div className="space-y-6">
      {!deceased && (
        <div className="flex justify-end">
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Adicionar foto ou vídeo
          </Button>
        </div>
      )}
      <section aria-labelledby="stories">
        <h3 id="stories" className="mb-2 text-sm font-semibold">
          Stories (24 h)
        </h3>
        {activeStories.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nenhum story ativo.</p>
        ) : (
          <ul className="flex gap-3 overflow-x-auto pb-2">
            {activeStories.map((s) => (
              <li key={s.id} className="shrink-0">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-full border-2 border-brand-500 p-0.5">
                  {s.kind === "VIDEO" ? <video src={s.url} muted className="h-full w-full rounded-full object-cover" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.thumbUrl ?? s.url} alt={s.title ?? "Story"} className="h-full w-full rounded-full object-cover" />}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="feed">
        <h3 id="feed" className="mb-2 text-sm font-semibold">
          Galeria
        </h3>
        {items.length === 0 ? (
          <Empty title="Galeria vazia" description="Guarde os melhores momentos com título, descrição e data." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((m) => (
              <li key={m.id} className="card overflow-hidden p-0">
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-square bg-ink-100 dark:bg-ink-800">
                  {m.kind === "VIDEO" ? <video src={m.url} muted className="h-full w-full object-cover" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.thumbUrl ?? m.url} alt={m.title ?? ""} loading="lazy" className="h-full w-full object-cover" />}
                  <span className="absolute left-2 top-2 rounded-full bg-black/50 p-1 text-white">{m.kind === "VIDEO" ? <Video className="h-3.5 w-3.5" aria-label="Vídeo" /> : <ImageIcon className="h-3.5 w-3.5" aria-label="Foto" />}</span>
                </a>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{m.title ?? "Sem título"}</p>
                  <p className="text-xs text-[var(--muted)]">{fmtDate(m.takenAt)} · {VIS.find((v) => v[0] === m.visibility)?.[1] ?? m.visibility}</p>
                  {m.description && <p className="mt-1 line-clamp-2 text-xs">{m.description}</p>}
                  <button type="button" onClick={() => remove.mutateAsync({ path: `/${m.id}` }).then(() => toast("Removido.", "info")).catch((e) => toast(errorMessage(e), "error"))} className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-red-600" aria-label={`Remover ${m.title ?? "item"}`}>
                    <Trash2 className="h-3 w-3" aria-hidden /> Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Adicionar à galeria">
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > MEDIA_MAX_BYTES) return toast("Arquivo deve ter até 10 MB.", "error");
              setFile(f);
            }}
          />
          <button type="button" onClick={() => inputRef.current?.click()} className={cn("flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-sm", file ? "border-brand-400" : "")}>
            {file ? (
              <span className="truncate">{file.name}</span>
            ) : (
              <>
                <ImageIcon className="h-6 w-6 text-[var(--muted)]" aria-hidden />
                <span className="mt-1">Escolher foto ou vídeo</span>
                <span className="text-xs text-[var(--muted)]">Fotos até 10 MB · vídeos 16:9 ou 9:16 até 10 MB</span>
              </>
            )}
          </button>
          <Input id="g-title" label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} />
          <Textarea id="g-desc" label="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="g-date" type="date" label="Data do momento" value={form.takenAt} max={toDateKey()} onChange={(e) => setForm({ ...form, takenAt: e.target.value })} />
            <Select id="g-vis" label="Visibilidade" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              {VIS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <Input id="g-notes" label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isStory} onChange={(e) => setForm({ ...form, isStory: e.target.checked })} className="h-4 w-4 accent-brand-500" /> Publicar como story (some em 24 h)
          </label>
          {busy && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" onClick={submit} disabled={!file} loading={busy}>
              Enviar
            </Button>
          </div>
        </div>
      </Modal>
      {items.length > 0 && <p className="text-xs text-[var(--muted)]">Último envio: {fmtDateTime(items[0]!.takenAt)}</p>}
    </div>
  );
}
