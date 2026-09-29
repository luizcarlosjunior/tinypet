"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { CheckCircle2, ImageIcon, ImagePlus, Search, X } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { Tabs } from "@/components/painel/ui";
import { useBlogMedia } from "@/hooks/use-blog-admin";
import { CROP_PRESETS, type BlogMediaItem } from "@/lib/blog-media";
import { BlogQueryState } from "./common";
import { CropUploader } from "./CropUploader";

/** Insert-image modal of the editor: "Enviar" (crop 16:9 → 1920×1080 upload) or "Galeria" (search existing media). */
export function EditorImageModal({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (img: { src: string; alt: string }) => void }) {
  const [tab, setTab] = useState<"upload" | "gallery">("upload");
  const [alt, setAlt] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BlogMediaItem[]>([]);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);
  const media = useBlogMedia({ q: debounced, page, pageSize: 30 }, open && tab === "gallery");
  useEffect(() => {
    if (!media.data) return;
    setItems((prev) => (page === 1 ? media.data.items : [...prev, ...media.data.items.filter((m) => !prev.some((p) => p.id === m.id))]));
  }, [media.data, page]);
  useEffect(() => {
    if (!open) {
      setAlt("");
      setTab("upload");
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector('[aria-label="Recortar imagem"]') && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const meta = media.data?.meta;
  const hasMore = meta ? meta.page * meta.pageSize < meta.total : false;
  const pick = (m: { url: string; alt?: string | null; originalFilename?: string }) => {
    onSelect({ src: m.url, alt: alt.trim() || m.alt || "" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Inserir imagem" className="flex h-full w-full flex-col overflow-hidden bg-[var(--card)] p-4 sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Inserir imagem</h2>
            <p className="text-sm text-[var(--muted)]">Envie e recorte uma nova imagem (16:9, 1920×1080) ou escolha uma da galeria.</p>
          </div>
          <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <Input id="editor-img-alt" label="Texto alternativo (alt)" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Descreva a imagem para leitores de tela" maxLength={300} />
        <Tabs
          className="mt-3"
          value={tab}
          onChange={setTab}
          items={[
            { key: "upload", label: "Enviar" },
            { key: "gallery", label: "Galeria" },
          ]}
        />
        {tab === "upload" ? (
          <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center">
            <ImagePlus className="h-10 w-10 text-[var(--muted)]" aria-hidden />
            <p className="text-sm text-[var(--muted)]">A imagem será recortada em 16:9 e salva em 1920×1080 (WebP).</p>
            <CropUploader preset={CROP_PRESETS.inline} buttonOnly buttonLabel="Selecionar imagem" alt={alt} onChange={(url) => url && pick({ url })} />
          </div>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
              <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome do arquivo ou alt…" aria-label="Buscar mídia" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <BlogQueryState isLoading={media.isLoading && page === 1} error={media.error} retry={() => media.refetch()}>
                {items.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[var(--muted)]">{debounced ? `Nenhuma imagem para "${debounced}".` : "Nenhuma imagem na biblioteca."}</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {items.map((m) => (
                      <li key={m.id}>
                        <button type="button" onClick={() => pick(m)} className="group relative block aspect-square w-full overflow-hidden rounded-xl border-2 border-transparent bg-ink-100 transition hover:border-brand-500 dark:bg-ink-800" title={m.originalFilename}>
                          <img src={m.url} alt={m.alt ?? m.originalFilename} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                          <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent p-1.5 text-left text-[10px] text-white">{m.originalFilename}</span>
                          <span className="absolute inset-0 flex items-center justify-center bg-brand-500/20 opacity-0 transition group-hover:opacity-100">
                            <CheckCircle2 className="h-8 w-8 text-white" aria-hidden />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {hasMore && (
                  <div className="flex justify-center py-4">
                    <Button type="button" variant="secondary" onClick={() => setPage((p) => p + 1)} loading={media.isFetching}>
                      Carregar mais
                    </Button>
                  </div>
                )}
                {media.isFetching && page > 1 && !hasMore && <Spinner className="mx-auto my-3" />}
              </BlogQueryState>
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-[var(--muted)]">
              <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Clique para inserir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
