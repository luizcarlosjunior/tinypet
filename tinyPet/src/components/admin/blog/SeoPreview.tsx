"use client";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, truncate } from "@/lib/blog-utils";
import { cn } from "@/lib/utils";

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={cn("tabular-nums", n === 0 ? "text-[var(--muted)]" : n <= max ? "text-emerald-600" : "text-red-600")}>{n}/{max}</span>;
}

/** Google-like snippet with 60/180 counters (effective title/description after fallbacks). */
export function SeoPreview({ title, description, url, siteName = "tinyPet" }: { title: string; description: string; url: string; siteName?: string }) {
  let host = url;
  let path = "";
  try {
    const u = new URL(url);
    host = u.host;
    path = u.pathname.split("/").filter(Boolean).join(" › ");
  } catch {
    /* keep raw */
  }
  return (
    <div className="space-y-2">
      <div className="rounded-xl border bg-white p-3 text-left dark:bg-ink-950" aria-label="Pré-visualização no Google">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">tP</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm text-ink-900 dark:text-ink-100">{siteName}</p>
            <p className="truncate text-xs text-ink-600 dark:text-ink-300">
              {host}
              {path && ` › ${path}`}
            </p>
          </div>
        </div>
        <p className="mt-1.5 truncate text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{truncate(title || "Título do post", SEO_TITLE_MAX)}</p>
        <p className="line-clamp-2 text-sm text-ink-700 dark:text-ink-300">{truncate(description || "Adicione um resumo ou uma descrição SEO para aparecer aqui.", SEO_DESCRIPTION_MAX)}</p>
      </div>
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>
          Título <Counter n={title.length} max={SEO_TITLE_MAX} />
        </span>
        <span>
          Descrição <Counter n={description.length} max={SEO_DESCRIPTION_MAX} />
        </span>
      </div>
    </div>
  );
}
