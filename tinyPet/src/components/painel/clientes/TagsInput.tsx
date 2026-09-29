"use client";
import { X } from "lucide-react";
import { useState } from "react";

export const SOURCES = ["Indicação", "Instagram", "Google", "Passante", "Outro"];

/** Chips input: type + Enter/comma adds a tag. */
export function TagsInput({ value, onChange, id = "tags", label = "Etiquetas" }: { value: string[]; onChange: (v: string[]) => void; id?: string; label?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().replace(/,$/, "");
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="input flex min-h-[42px] flex-wrap items-center gap-1.5 py-1">
        {value.map((t) => (
          <span key={t} className="badge bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
            {t}
            <button type="button" className="ml-1 rounded-full hover:bg-brand-200/60" aria-label={`Remover etiqueta ${t}`} onClick={() => onChange(value.filter((v) => v !== t))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          placeholder={value.length ? "" : "VIP, inadimplente… (Enter para adicionar)"}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
}
