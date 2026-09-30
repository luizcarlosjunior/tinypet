"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Link2, X } from "lucide-react";
import { safeHref } from "@tinypet/shared";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type LightboxItem = { id: string; kind: "IMAGE" | "VIDEO"; url: string; thumbUrl?: string | null; title?: string | null; description?: string | null; caption?: string | null };

/** File name for downloads: title (or "tinypet") + the extension of the URL. */
function fileName(item: LightboxItem) {
  const ext = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(item.url)?.[1] ?? (item.kind === "VIDEO" ? "mp4" : "webp");
  const base = (item.title ?? "tinypet").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "tinypet";
  return `${base}.${ext}`;
}

/**
 * Full-screen viewer for photos/videos: arrows (and ←/→) to navigate, "Baixar" and "Copiar link".
 * Closes on ✕ or Escape only (not on a click outside), like the other dialogs.
 */
export function Lightbox({ items, index, onIndex, onClose, extra }: { items: LightboxItem[]; index: number; onIndex: (i: number) => void; onClose: () => void; extra?: (item: LightboxItem) => React.ReactNode }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;
  const prev = useCallback(() => hasPrev && onIndex(index - 1), [hasPrev, index, onIndex]);
  const next = useCallback(() => hasNext && onIndex(index + 1), [hasNext, index, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, prev, next]);

  if (!item) return null;

  async function download() {
    setBusy(true);
    try {
      // Cross-origin URLs (S3/CloudFront) ignore <a download>: fetch the bytes and save a blob.
      const res = await fetch(item.url, { mode: "cors" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName(item);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      // Storage without CORS for GET: open the file so the user can save it from the browser.
      window.open(safeHref(item.url), "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(item.url);
      toast("Link copiado.", "success");
    } catch {
      toast("Não foi possível copiar o link.", "error");
    }
  }

  const btn = "inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50";
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={item.title ?? (item.kind === "VIDEO" ? "Vídeo" : "Foto")}>
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <p className="min-w-0 flex-1 truncate text-sm text-white/80">
          {item.title ?? ""}
          {items.length > 1 && <span className="ml-2 text-white/50">{index + 1} de {items.length}</span>}
        </p>
        <button type="button" onClick={download} className={btn} disabled={busy} aria-label="Baixar">
          <Download className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Baixar</span>
        </button>
        <button type="button" onClick={copyLink} className={btn} aria-label="Copiar link">
          <Link2 className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Copiar link</span>
        </button>
        <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Fechar">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2 sm:px-16">
        {item.kind === "VIDEO" ? (
          <video key={item.id} src={safeHref(item.url)} poster={item.thumbUrl ? safeHref(item.thumbUrl) : undefined} controls autoPlay playsInline className="max-h-full max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.id} src={safeHref(item.url)} alt={item.title ?? ""} className="max-h-full max-w-full select-none object-contain" />
        )}
        {hasPrev && (
          <button type="button" onClick={prev} className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:left-4" aria-label="Anterior">
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        )}
        {hasNext && (
          <button type="button" onClick={next} className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:right-4" aria-label="Próxima">
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
        )}
      </div>
      {(item.description || item.caption || extra) && (
        <div className={cn("flex flex-wrap items-center gap-3 px-4 pb-4 text-sm text-white/80")}>
          {(item.description || item.caption) && <p className="min-w-0 flex-1">{item.description ?? item.caption}</p>}
          {extra?.(item)}
        </div>
      )}
    </div>,
    document.body,
  );
}
