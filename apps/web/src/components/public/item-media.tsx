"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { PublicItemMedia } from "./types";
import { cn } from "@/lib/utils";
import { safeHref } from "@tinypet/shared";

export function ItemMedia({ media, name }: { media: PublicItemMedia[]; name: string }) {
  const sorted = [...media].sort((a, b) => Number(!!b.isCover) - Number(!!a.isCover) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const [idx, setIdx] = useState(0);
  const current = sorted[idx];
  if (!current) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-ink-100 text-[var(--muted)] dark:bg-ink-800">
        <ImageOff className="h-10 w-10" aria-hidden />
        <span className="sr-only">Sem imagem</span>
      </div>
    );
  }
  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-ink-100 dark:bg-ink-800">
        {current.kind === "VIDEO" ? (
          <video src={safeHref(current.url)} controls className="aspect-square w-full object-contain" aria-label={`Vídeo de ${name}`} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeHref(current.url)} alt={name} className="aspect-square w-full object-cover" />
        )}
      </div>
      {sorted.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto" aria-label="Mais fotos">
          {sorted.map((m, i) => (
            <li key={m.id ?? i}>
              <button type="button" onClick={() => setIdx(i)} aria-label={`Mostrar mídia ${i + 1}`} aria-pressed={i === idx} className={cn("h-16 w-16 overflow-hidden rounded-lg border-2", i === idx ? "border-brand-500" : "border-transparent")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={safeHref(m.thumbUrl ?? m.url)} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
