"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiList } from "@/lib/api-client";
import { Spinner } from "@/components/ui";
import { fmtPhone } from "@/lib/format";
import type { Client } from "@/types/api";
import { cn } from "@/lib/utils";

/** Async combobox searching `GET /clients?q=`. */
export function ClientSearch({ value, onChange, label = "Cliente", error, autoFocus, id }: { value: Client | null; onChange: (c: Client | null) => void; label?: string; error?: string; autoFocus?: boolean; id?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const auto = useId();
  const inputId = id ?? auto;
  const listId = `${inputId}-list`;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const res = useQuery({ queryKey: ["clients", "search", debounced], queryFn: () => apiList<Client[]>(`/clients?q=${encodeURIComponent(debounced)}&pageSize=8`), enabled: open, staleTime: 10_000 });
  const items = res.data?.data ?? [];
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  useEffect(() => setActive(0), [items.length]);

  if (value) {
    return (
      <div>
        <span className="label">{label}</span>
        <div className="flex items-center gap-2 rounded-xl border bg-[var(--card)] px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{value.name}</span>
            {value.primaryPhone && <span className="text-xs text-[var(--muted)]">{fmtPhone(value.primaryPhone)}</span>}
          </span>
          <button type="button" className="text-xs text-brand-600 hover:underline dark:text-brand-300" onClick={() => onChange(null)}>
            Trocar
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  return (
    <div ref={ref} className="relative">
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${listId}-${items[active].id}` : undefined}
        autoFocus={autoFocus}
        className={cn("input", error && "border-red-500")}
        placeholder="Buscar por nome, telefone ou pet…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && open && items[active]) {
            e.preventDefault();
            onChange(items[active]);
            setOpen(false);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-[var(--card)] py-1 shadow-lg">
          {res.isLoading && (
            <li className="flex justify-center p-3">
              <Spinner />
            </li>
          )}
          {!res.isLoading && items.length === 0 && <li className="px-3 py-2 text-sm text-[var(--muted)]">Nenhum cliente encontrado.</li>}
          {items.map((c, i) => (
            <li key={c.id} id={`${listId}-${c.id}`} role="option" aria-selected={i === active}>
              <button type="button" className={cn("flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-ink-100 dark:hover:bg-ink-800", i === active && "bg-ink-100 dark:bg-ink-800")} onMouseEnter={() => setActive(i)} onClick={() => { onChange(c); setOpen(false); }}>
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-[var(--muted)]">
                  {[c.primaryPhone ? fmtPhone(c.primaryPhone) : null, petNames(c)].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function petNames(c: Client): string {
  return (c.pets ?? [])
    .map((p) => ("pet" in p ? p.pet : p))
    .map((p) => p.name)
    .join(", ");
}
export function clientPets(c: Client | null | undefined) {
  return (c?.pets ?? []).map((p) => ("pet" in p ? p.pet : p));
}
