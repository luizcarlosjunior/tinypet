"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { blogSlugify, sanitizeSlugInput, SLUG_MAX } from "@/lib/blog-utils";
import { cn } from "@/lib/utils";

/** Slug auto-generated from the title until the user edits it; shows the public URL (reference `SlugInput`). */
export function SlugInput({ value, title, onChange, initiallyManual, baseUrl, disabled, published }: { value: string; title: string; onChange: (slug: string) => void; initiallyManual?: boolean; baseUrl: string; disabled?: boolean; published?: boolean }) {
  const { toast } = useToast();
  const [manual, setManual] = useState(!!initiallyManual);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (!manual) onChangeRef.current(blogSlugify(title));
  }, [title, manual]);
  const len = value.length;
  const color = len === 0 ? "text-[var(--muted)]" : len <= 60 ? "text-emerald-600" : len <= SLUG_MAX ? "text-amber-600" : "text-red-600";
  const url = `${baseUrl}/blog/${value || "…"}`;
  return (
    <div>
      <label htmlFor="post-slug" className="label flex items-center">
        URL amigável (slug)
        <span className={cn("ml-auto tabular-nums", color)}>
          {len}/{SLUG_MAX}
        </span>
      </label>
      <div className="flex gap-2">
        <input
          id="post-slug"
          className="input font-mono text-xs"
          value={value}
          disabled={disabled}
          maxLength={SLUG_MAX}
          onChange={(e) => {
            setManual(true);
            onChange(sanitizeSlugInput(e.target.value));
          }}
          onBlur={() => onChange(blogSlugify(value))}
          placeholder="gerado-a-partir-do-titulo"
        />
        <button
          type="button"
          className="btn-secondary shrink-0 px-3"
          title="Gerar a partir do título"
          aria-label="Gerar slug a partir do título"
          disabled={disabled}
          onClick={() => {
            setManual(false);
            onChange(blogSlugify(title));
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--muted)]">
        <span className="truncate">{url}</span>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 hover:bg-ink-100 dark:hover:bg-ink-800"
          aria-label="Copiar URL"
          onClick={() => {
            navigator.clipboard?.writeText(url).then(
              () => toast("URL copiada", "success"),
              () => undefined,
            );
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </p>
      {published && manual && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Alterar o slug de um post publicado cria um redirecionamento do endereço antigo.</p>}
    </div>
  );
}
