"use client";
import { useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, File as FileIcon, Loader2, UploadCloud, X } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { Checkbox } from "@/components/painel/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { ACCEPT_ATTR, DEFAULT_QUALITY, formatBytes, processImageFile, uploadBlogMedia, validateImageFile, type BlogMediaItem } from "@/lib/blog-media";
import { ProgressBar, QualitySlider } from "./common";

type Status = "pending" | "processing" | "uploading" | "success" | "error";
type Item = { key: string; file: File; status: Status; progress: number; error?: string; sentSize?: number };

/** Multi-file upload queue (reference `MediaUploadDialog`): optional browser optimization (WebP ≤ 1920 px) + XHR progress. */
export function MediaUploadDialog({ open, onClose, onUploaded }: { open: boolean; onClose: () => void; onUploaded: (items: BlogMediaItem[]) => void }) {
  const id = useId();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [optimize, setOptimize] = useState(true);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const patch = (key: string, p: Partial<Item>) => setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Item[] = [];
    for (const f of Array.from(files)) {
      const err = validateImageFile(f);
      next.push({ key: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`, file: f, status: err ? "error" : "pending", progress: 0, error: err ?? undefined });
    }
    setQueue((q) => [...q, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    if (busy) return;
    setQueue([]);
    onClose();
  };

  const run = async () => {
    const pending = queue.filter((i) => i.status === "pending");
    if (!pending.length) return;
    setBusy(true);
    const done: BlogMediaItem[] = [];
    let failed = 0;
    for (const item of pending) {
      try {
        patch(item.key, { status: "processing" });
        const processed = await processImageFile(item.file, { optimize, quality });
        if (processed.error) toast(`Falha na otimização de ${item.file.name}: enviando o original.`, "error");
        patch(item.key, { status: "uploading", sentSize: processed.file.size });
        const media = await uploadBlogMedia(processed.file, { quality }, (p) => patch(item.key, { progress: p }));
        patch(item.key, { status: "success", progress: 100 });
        done.push(media);
      } catch (e) {
        failed++;
        patch(item.key, { status: "error", error: errorMessage(e, "Falha no envio") });
      }
    }
    setBusy(false);
    if (done.length) {
      toast(`${done.length} de ${pending.length} arquivo(s) enviado(s).`, "success");
      onUploaded(done);
    }
    if (!failed && done.length) {
      setQueue([]);
      onClose();
    }
  };

  const pendingCount = queue.filter((i) => i.status === "pending").length;
  return (
    <Modal open={open} onClose={close} title="Adicionar mídia" className="sm:max-w-2xl">
      <div className="space-y-4">
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) addFiles(e.dataTransfer.files);
          }}
        >
          <UploadCloud className="h-8 w-8 text-[var(--muted)]" aria-hidden />
          <p className="text-sm">Arraste imagens aqui ou</p>
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
            Selecionar arquivos
          </Button>
          <input ref={inputRef} id={`${id}-f`} type="file" multiple accept={ACCEPT_ATTR} className="hidden" onChange={(e) => addFiles(e.target.files)} aria-label="Arquivos" />
          <p className="text-xs text-[var(--muted)]">JPEG, PNG, WebP ou GIF · até 10 MB · SVG não é aceito</p>
        </div>
        <Checkbox checked={optimize} onChange={(e) => setOptimize(e.target.checked)} disabled={busy} label="Otimizar imagens" description="Converte para WebP e limita o maior lado a 1920 px (GIFs são mantidos)." />
        {optimize && <QualitySlider id={`${id}-q`} value={quality} onChange={setQuality} disabled={busy} />}
        {queue.length > 0 && (
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-2">
            {queue.map((i) => (
              <li key={i.key} className="flex items-center gap-3 rounded-lg border p-2">
                <FileIcon className="h-5 w-5 shrink-0 text-[var(--muted)]" aria-hidden />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium" title={i.file.name}>
                    {i.file.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatBytes(i.file.size)}
                    {i.sentSize != null && i.sentSize !== i.file.size && ` → ${formatBytes(i.sentSize)}`}
                  </p>
                  {(i.status === "uploading" || i.status === "success") && <ProgressBar value={i.progress} />}
                  {i.status === "error" && <p className="truncate text-xs text-red-600">Erro: {i.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {i.status === "pending" && <span className="text-xs text-[var(--muted)]">Aguardando</span>}
                  {i.status === "processing" && <span className="text-xs text-[var(--muted)]">Otimizando…</span>}
                  {i.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-brand-500" aria-label="Enviando" />}
                  {i.status === "success" && <CheckCircle className="h-4 w-4 text-emerald-600" aria-label="Enviado" />}
                  {i.status === "error" && <AlertTriangle className="h-4 w-4 text-red-600" aria-label="Erro" />}
                  <button type="button" className="btn-ghost h-7 w-7 p-0" onClick={() => setQueue((q) => q.filter((x) => x.key !== i.key))} disabled={busy && i.status !== "pending" && i.status !== "error"} aria-label="Remover da lista">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            {queue.length && !pendingCount ? "Fechar" : "Cancelar"}
          </Button>
          <Button type="button" onClick={run} loading={busy} disabled={!pendingCount}>
            {!busy && <UploadCloud className="h-4 w-4" aria-hidden />}
            {busy ? "Enviando…" : `Enviar ${pendingCount} arquivo(s)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
