"use client";
import { useState } from "react";
import { Video } from "lucide-react";
import { safeHref } from "@tinypet/shared";
import { Lightbox, type LightboxItem } from "@/components/media/lightbox";
import { ReportMediaButton } from "@/components/media/report-media";

/** Public gallery grid (PUBLIC items only) with the full-screen viewer; visitors can report media. */
export function PublicPetGallery({ items }: { items: LightboxItem[] }) {
  const [index, setIndex] = useState<number | null>(null);
  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {items.map((m, i) => (
          <li key={m.id}>
            <button type="button" onClick={() => setIndex(i)} className="relative block aspect-square w-full overflow-hidden rounded-lg bg-ink-100 dark:bg-ink-800" aria-label={`Abrir ${m.kind === "VIDEO" ? "vídeo" : "foto"}${m.title ? ` ${m.title}` : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.kind === "VIDEO" && !m.thumbUrl ? <video src={safeHref(m.url)} muted preload="metadata" className="h-full w-full object-cover" /> : <img src={safeHref(m.thumbUrl ?? m.url)} alt={m.title ?? ""} loading="lazy" className="h-full w-full object-cover transition hover:scale-[1.03]" />}
              {m.kind === "VIDEO" && <Video className="absolute right-1.5 top-1.5 h-4 w-4 text-white drop-shadow" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      {index !== null && <Lightbox items={items} index={index} onIndex={setIndex} onClose={() => setIndex(null)} extra={(it) => <ReportMediaButton url={it.url} kind={it.kind} className="text-white/70 hover:text-red-400" />} />}
    </>
  );
}
