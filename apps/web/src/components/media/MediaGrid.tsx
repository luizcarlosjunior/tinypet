"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Film, ImagePlus, Star, Trash2, Video } from "lucide-react";
import { UploadButton } from "./UploadButton";
import { VideoUploader } from "./VideoUploader";
import { VideoCoverEditor } from "./VideoCoverEditor";
import { Button, Modal } from "@/components/ui";
import type { MediaPurpose } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { safeHref } from "@tinypet/shared";

/** `assetId`/`width`/`height` are client-only (known for items uploaded in this session; used to change a video cover). */
export type MediaItem = { kind: "IMAGE" | "VIDEO"; url: string; thumbUrl?: string | null; isCover?: boolean; sortOrder?: number; caption?: string | null; assetId?: string; width?: number | null; height?: number | null };

/** Grid of up to `max` media items with cover selection and up/down ordering. */
export function MediaGrid({ items, onChange, purpose, partnerId, max = 10, allowVideo = true, withCover = true, withCaption = false, error }: { items: MediaItem[]; onChange: (items: MediaItem[]) => void; purpose: MediaPurpose; partnerId?: string | null; max?: number; allowVideo?: boolean; withCover?: boolean; withCaption?: boolean; error?: (e: unknown) => void }) {
  const normalize = (list: MediaItem[]) => {
    const withOrder = list.map((m, i) => ({ ...m, sortOrder: i }));
    if (withCover && withOrder.length && !withOrder.some((m) => m.isCover)) withOrder[0]!.isCover = true;
    return withOrder;
  };
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [coverFor, setCoverFor] = useState<number | null>(null);
  const coverItem = coverFor != null ? items[coverFor] : undefined;
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(normalize(next));
  };
  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Mídias">
        {items.map((m, i) => (
          <li key={`${m.url}-${i}`} className={cn("relative overflow-hidden rounded-xl border bg-ink-100 dark:bg-ink-900", m.isCover && withCover && "ring-2 ring-brand-500")}>
            <div className="aspect-square">
              {m.kind === "VIDEO" ? (
                <div className="flex h-full w-full items-center justify-center">
                  {m.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={safeHref(m.thumbUrl)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Video className="h-8 w-8 text-[var(--muted)]" aria-label="Vídeo" />
                  )}
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={safeHref(m.thumbUrl || m.url)} alt={m.caption ?? `Mídia ${i + 1}`} className="h-full w-full object-cover" />
              )}
            </div>
            {m.isCover && withCover && <span className="absolute left-2 top-2 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white">Capa</span>}
            <div className="flex items-center justify-between gap-1 bg-[var(--card)] p-1">
              <button type="button" className="btn-ghost h-7 w-7 p-0" aria-label="Mover para cima" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className="btn-ghost h-7 w-7 p-0" aria-label="Mover para baixo" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="h-4 w-4" />
              </button>
              {m.kind === "VIDEO" && m.assetId && (
                <button type="button" className="btn-ghost h-7 w-7 p-0" aria-label="Trocar capa do vídeo" title="Trocar capa do vídeo" onClick={() => setCoverFor(i)}>
                  <ImagePlus className="h-4 w-4" />
                </button>
              )}
              {withCover && (
                <button type="button" className={cn("btn-ghost h-7 w-7 p-0", m.isCover && "text-brand-500")} aria-label="Definir como capa" aria-pressed={!!m.isCover} onClick={() => onChange(items.map((x, j) => ({ ...x, isCover: j === i })))}>
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button type="button" className="btn-ghost h-7 w-7 p-0 text-red-600" aria-label="Remover" onClick={() => onChange(normalize(items.filter((_, j) => j !== i)))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {withCaption && <input type="text" aria-label={`Legenda da foto ${i + 1}`} placeholder="Legenda" maxLength={140} value={m.caption ?? ""} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} className="w-full border-t bg-[var(--card)] px-2 py-1 text-xs outline-none" />}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <UploadButton purpose={purpose} partnerId={partnerId} multiple accept="image/*" disabled={items.length >= max} label={allowVideo ? "Adicionar fotos" : "Adicionar mídia"} onError={error} onUploaded={(m) => onChange(normalize([...items, { kind: m.kind, url: m.url, thumbUrl: m.thumbUrl, assetId: m.id, width: m.width, height: m.height }].slice(0, max)))} />
        {allowVideo && (
          <Button type="button" variant="secondary" disabled={items.length >= max} onClick={() => setVideoOpen(true)}>
            <Film className="h-4 w-4" aria-hidden /> Adicionar vídeo
          </Button>
        )}
        <span className="text-xs text-[var(--muted)]">
          {items.length}/{max} · fotos até 10 MB{allowVideo ? "; vídeos convertidos para MP4 16:9 ou 9:16" : ""}
        </span>
      </div>
      <Modal open={videoOpen} onClose={() => (!videoBusy || window.confirm("Cancelar a conversão/envio do vídeo?")) && setVideoOpen(false)} title="Adicionar vídeo" className="sm:max-w-xl">
        {videoOpen && (
          <VideoUploader
            purpose={purpose}
            partnerId={partnerId}
            onError={error}
            onCancel={() => setVideoOpen(false)}
            onBusyChange={setVideoBusy}
            onUploaded={(m) => {
              onChange(normalize([...items, { kind: "VIDEO" as const, url: m.url, thumbUrl: m.thumbUrl, assetId: m.id, width: m.width, height: m.height }].slice(0, max)));
              setVideoOpen(false);
            }}
          />
        )}
      </Modal>
      <Modal open={!!coverItem} onClose={() => setCoverFor(null)} title="Trocar capa do vídeo">
        {coverItem?.assetId && (
          <VideoCoverEditor
            assetId={coverItem.assetId}
            portrait={!!coverItem.width && !!coverItem.height && coverItem.height > coverItem.width}
            partnerId={partnerId}
            onCancel={() => setCoverFor(null)}
            onSaved={(m) => {
              onChange(items.map((x, j) => (j === coverFor ? { ...x, thumbUrl: m.thumbUrl ?? x.thumbUrl } : x)));
              setCoverFor(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
