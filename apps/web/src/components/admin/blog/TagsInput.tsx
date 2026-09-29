"use client";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { normalizeTags } from "@/lib/blog-utils";
import { cn } from "@/lib/utils";

/** Chips input: Enter, "," or ";" adds; Backspace on empty removes the last tag. */
export function TagsInput({ value, onChange, disabled, id = "post-tags", max = 20 }: { value: string[]; onChange: (tags: string[]) => void; disabled?: boolean; id?: string; max?: number }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const add = (raw: string) => {
    const next = normalizeTags([...value, ...raw.split(/[,;]/)]).slice(0, max);
    onChange(next);
    setText("");
  };
  return (
    <div className={cn("input flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 py-1.5", disabled && "pointer-events-none opacity-60")} onClick={() => ref.current?.focus()}>
      {value.map((t) => (
        <span key={t} className="badge gap-1 bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
          {t}
          <button type="button" className="rounded-full hover:bg-brand-200 dark:hover:bg-brand-800" aria-label={`Remover tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        ref={ref}
        value={text}
        disabled={disabled || value.length >= max}
        onChange={(e) => {
          const v = e.target.value;
          if (/[,;]$/.test(v)) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (text.trim()) add(text);
          } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => text.trim() && add(text)}
        className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0"
        placeholder={value.length ? "" : "Digite e pressione Enter ou vírgula"}
        aria-label="Adicionar tag"
      />
    </div>
  );
}
