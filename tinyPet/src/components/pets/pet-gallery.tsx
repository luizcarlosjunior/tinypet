"use client";
import { useRef, useState } from "react";
import { Image as ImageIcon, Lock, Plus, Trash2, Video } from "lucide-react";
import { usePetMutation, usePetResource } from "@/hooks/use-pets";
import { isVideoFile, uploadFile, type UploadedMedia } from "@/lib/upload";
import { VideoUploader } from "@/components/media/VideoUploader";
import { errorMessage, planLimitOf } from "@/lib/errors";
import { fmtDate, fmtDateTime, toDateKey } from "@/lib/format";
import { Button, Empty, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { PlanLimitNotice } from "./plan-limit-notice";
import { ReportMediaButton } from "@/components/media/report-media";
import { Lightbox } from "@/components/media/lightbox";
import { useSessionContext } from "@/hooks/use-session-context";
import { MEDIA_MAX_BYTES, VIDEO_SOURCE_MIME, safeHref } from "@tinypet/shared";
import type { PlanLimitError } from "@tinypet/shared";
import { cn } from "@/lib/utils";
import { ImageCropper, type CropRect } from "@/components/media/ImageCropper";
import { IMAGE_ACCEPT, decodableFile, isImageFile, loadImage, toWebpFile } from "@/lib/image-webp";

const ASPECTS = [
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
] as const;
/** Photos are converted to ≤ 1920 px WebP before upload, so the picked file may be bigger than the 10 MB upload cap. */
const PHOTO_INPUT_MAX_BYTES = 40 * 1024 * 1024;

type Media = { id: string; kind: "IMAGE" | "VIDEO"; uploadedByUserId?: string | null; url: string; thumbUrl: string | null; title: string | null; description: string | null; notes: string | null; takenAt: string; isStory: boolean; expiresAt: string | null; visibility: string };
const VIS = [["PRIVATE", "Privado"], ["FAMILY", "Família"], ["PARTNERS", "Parceiros vinculados"], ["PUBLIC", "Público"]] as const;

export function PetGallery({ petId, deceased, readOnly = false }: { petId: string; deceased: boolean; readOnly?: boolean }) {
  // Media uploaded by someone else (partner, owner of a shared pet) can be reported.
  const me = useSessionContext().user?.id ?? null;
  const [viewer, setViewer] = useState<{ list: "feed" | "stories"; index: number } | null>(null);
  const feed = usePetResource<Media[]>(petId, "media");
  const stories = usePetResource<Media[]>(petId, "media", "?story=1");
  const create = usePetMutation<Record<string, unknown>>(petId, "media");
  const remove = usePetMutation(petId, "media", "DELETE");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState<PlanLimitError | null>(null);
  const [file, setFile] = useState<File | null>(null);
  // photos: cropped in the browser (1:1, 16:9 or 9:16), scaled to ≤ 1920 px and converted to WebP before upload
  const [aspect, setAspect] = useState<number>(1);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [converting, setConverting] = useState(false);
  const [busy, setBusy] = useState(false);
  /** True while the video is probing/transcoding/uploading: the dialog must not close mid-job. */
  const [videoBusy, setVideoBusy] = useState(false);
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

  function resetForm() {
    setOpen(false);
    setFile(null);
    setForm({ title: "", description: "", notes: "", takenAt: toDateKey(), isStory: false, visibility: "PRIVATE" });
  }

  async function createItem(up: Pick<UploadedMedia, "kind" | "url" | "thumbUrl" | "sizeBytes">) {
    await create.mutateAsync({
      body: { kind: up.kind, url: up.url, thumbUrl: up.thumbUrl, title: form.title || null, description: form.description || null, notes: form.notes || null, takenAt: new Date(`${form.takenAt}T12:00:00`).toISOString(), isStory: form.isStory, visibility: form.visibility, sizeBytes: up.sizeBytes },
    });
    toast(form.isStory ? "Story publicado por 24 h." : "Adicionado à galeria!", "success");
    resetForm();
  }

  function handleCreateError(e: unknown) {
    const pl = planLimitOf(e);
    if (pl) {
      setLimit(pl);
      setOpen(false);
    } else toast(errorMessage(e), "error");
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const webp = await toWebpFile(await loadImage(file), file.name, crop);
      if (webp.size > MEDIA_MAX_BYTES) throw new Error("A foto convertida passou de 10 MB. Tente um recorte menor.");
      const up = await uploadFile(webp, "PET_GALLERY", { onProgress: setProgress, partnerId: null });
      await createItem(up);
    } catch (e) {
      handleCreateError(e);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  const isVideo = !!file && isVideoFile(file);

  const items = feed.data ?? [];
  const activeStories = (stories.data ?? []).filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > Date.now());

  return (
    <div className="space-y-6">
      {!deceased && !readOnly && (
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
                <button type="button" onClick={() => setViewer({ list: "stories", index: activeStories.indexOf(s) })} aria-label={`Abrir story ${s.title ?? ""}`.trim()} className="block h-20 w-20 overflow-hidden rounded-full border-2 border-brand-500 p-0.5">
                  {s.kind === "VIDEO" ? <video src={safeHref(s.url)} poster={s.thumbUrl ? safeHref(s.thumbUrl) : undefined} muted preload="metadata" className="h-full w-full rounded-full object-cover" /> : /* eslint-disable-line @next/next/no-img-element */ <img src={safeHref(s.thumbUrl ?? s.url)} alt={s.title ?? "Story"} className="h-full w-full rounded-full object-cover" />}
                </button>
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
                <button type="button" onClick={() => setViewer({ list: "feed", index: items.indexOf(m) })} aria-label={`Abrir ${m.kind === "VIDEO" ? "vídeo" : "foto"}${m.title ? ` ${m.title}` : ""} em tela cheia`} className="relative block aspect-square w-full bg-ink-100 dark:bg-ink-800">
                  {m.kind === "VIDEO" ? <video src={safeHref(m.url)} poster={m.thumbUrl ? safeHref(m.thumbUrl) : undefined} muted preload="metadata" className="h-full w-full object-cover" /> : /* eslint-disable-line @next/next/no-img-element */ <img src={safeHref(m.thumbUrl ?? m.url)} alt={m.title ?? ""} loading="lazy" className="h-full w-full object-cover" />}
                  <span className="absolute left-2 top-2 rounded-full bg-black/50 p-1 text-white">{m.kind === "VIDEO" ? <Video className="h-3.5 w-3.5" aria-label="Vídeo" /> : <ImageIcon className="h-3.5 w-3.5" aria-label="Foto" />}</span>
                </button>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{m.title ?? "Sem título"}</p>
                  <p className="text-xs text-[var(--muted)]">{fmtDate(m.takenAt)} · {VIS.find((v) => v[0] === m.visibility)?.[1] ?? m.visibility}</p>
                  {m.description && <p className="mt-1 line-clamp-2 text-xs">{m.description}</p>}
                  {me && m.uploadedByUserId !== me && <ReportMediaButton url={m.url} kind={m.kind} className="mr-3 mt-2" />}
                  {!readOnly && <button type="button" onClick={() => remove.mutateAsync({ path: `/${m.id}` }).then(() => toast("Removido.", "info")).catch((e) => toast(errorMessage(e), "error"))} className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-red-600" aria-label={`Remover ${m.title ?? "item"}`}>
                    <Trash2 className="h-3 w-3" aria-hidden /> Remover
                  </button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={open} onClose={() => !busy && !videoBusy && setOpen(false)} title="Adicionar à galeria">
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept={`${IMAGE_ACCEPT},${VIDEO_SOURCE_MIME.join(",")},.mov,.mkv,.3gp`}
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              // Videos are converted in the browser (any size in; ≤ 10 MB out).
              if (isVideoFile(f)) return setFile(f);
              if (!isImageFile(f)) return toast("Formato não suportado. Use uma foto (JPG, PNG, WebP, HEIC, GIF, AVIF) ou um vídeo.", "error");
              // Photos are resized to ≤ 1920 px and converted to WebP here, so larger camera files are fine.
              if (f.size > PHOTO_INPUT_MAX_BYTES) return toast("Foto muito grande (máximo 40 MB).", "error");
              setConverting(true);
              try {
                const decodable = await decodableFile(f);
                await loadImage(decodable); // fails early for formats the browser can't read (e.g. TIFF)
                setCrop(null);
                setFile(decodable);
              } catch (err) {
                toast(errorMessage(err), "error");
              } finally {
                setConverting(false);
              }
            }}
          />
          {isVideo ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{file.name}</span>
              <button type="button" className="text-xs underline" onClick={() => setFile(null)}>
                Trocar arquivo
              </button>
            </div>
          ) : file ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5" role="radiogroup" aria-label="Formato do recorte">
                  {ASPECTS.map((a) => (
                    <button key={a.label} type="button" role="radio" aria-checked={aspect === a.value} onClick={() => setAspect(a.value)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", aspect === a.value ? "border-brand-500 bg-brand-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
                      {a.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="text-xs underline" onClick={() => inputRef.current?.click()}>
                  Trocar arquivo
                </button>
              </div>
              <ImageCropper embedded file={file} onFile={(f) => setFile(f)} aspect={aspect} size={320} onCropChange={setCrop} hint="Arraste para posicionar e use o zoom. A foto é salva em WebP com até 1920 px." />
            </div>
          ) : (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={converting} className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-sm">
            {converting ? (
              <span>Abrindo a foto…</span>
            ) : (
              <>
                <ImageIcon className="h-6 w-6 text-[var(--muted)]" aria-hidden />
                <span className="mt-1">Escolher foto ou vídeo</span>
                <span className="text-xs text-[var(--muted)]">Fotos JPG, PNG, WebP, HEIC, GIF ou AVIF (recorte 1:1, 16:9 ou 9:16) · vídeos são convertidos para MP4</span>
              </>
            )}
          </button>
          )}
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
          {isVideo && (
            <VideoUploader
              key={`${file.name}-${file.size}-${file.lastModified}`}
              purpose="PET_GALLERY"
              partnerId={null}
              initialFile={file}
              onBusyChange={setVideoBusy}
              submitLabel={form.isStory ? "Publicar story" : "Enviar"}
              onCancel={() => setFile(null)}
              onUploaded={async (m) => {
                try {
                  await createItem(m);
                } catch (e) {
                  handleCreateError(e);
                }
              }}
            />
          )}
          {busy && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {!isVideo && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" onClick={submit} disabled={!file || !crop} loading={busy}>
              Enviar
            </Button>
          </div>
          )}
        </div>
      </Modal>
      {items.length > 0 && <p className="text-xs text-[var(--muted)]">Último envio: {fmtDateTime(items[0]!.takenAt)}</p>}
      {viewer && (
        <Lightbox
          items={viewer.list === "feed" ? items : activeStories}
          index={viewer.index}
          onIndex={(index) => setViewer({ ...viewer, index })}
          onClose={() => setViewer(null)}
          extra={(it) => {
            const m = (viewer.list === "feed" ? items : activeStories).find((x) => x.id === it.id);
            return m && me && m.uploadedByUserId !== me ? <ReportMediaButton url={m.url} kind={m.kind} className="text-white/70 hover:text-red-400" /> : null;
          }}
        />
      )}
    </div>
  );
}
