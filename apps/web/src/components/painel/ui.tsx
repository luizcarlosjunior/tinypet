"use client";
import { cn } from "@/lib/utils";
import { Button, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { X, AlertTriangle, Search } from "lucide-react";
import Link from "next/link";
import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { safeHref } from "@tinypet/shared";

/* ───────── Tabs (URL-less, controlled) ───────── */
export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; count?: number; hidden?: boolean }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b", className)}>
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <button
            key={i.key}
            role="tab"
            type="button"
            aria-selected={value === i.key}
            onClick={() => onChange(i.key)}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition", value === i.key ? "border-brand-500 text-brand-600 dark:text-brand-300" : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]")}
          >
            {i.label}
            {i.count != null && <span className="ml-1.5 rounded-full bg-ink-100 px-1.5 text-xs text-ink-700 dark:bg-ink-800 dark:text-ink-200">{i.count}</span>}
          </button>
        ))}
    </div>
  );
}

/* ───────── Link tabs (routed) ───────── */
export function LinkTabs({ items, current, className }: { items: { href: string; label: string }[]; current: string; className?: string }) {
  return (
    <nav className={cn("flex gap-1 overflow-x-auto border-b", className)} aria-label="Seções">
      {items.map((i) => {
        const active = current === i.href || (i.href !== "/painel" && current.startsWith(i.href));
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition", active ? "border-brand-500 text-brand-600 dark:text-brand-300" : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]")}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ───────── Pagination ───────── */
export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginação">
      <span className="text-[var(--muted)]">
        Página {page} de {pages} · {total} registros
      </span>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </Button>
        <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Próxima
        </Button>
      </div>
    </nav>
  );
}

/* ───────── Drawer (right side panel) ───────── */
export function Drawer({ open, onClose, title, children, className, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; className?: string; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} className={cn("flex h-full w-full flex-col bg-[var(--bg)] shadow-xl outline-none", wide ? "sm:max-w-2xl" : "sm:max-w-lg", className)} onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 border-b bg-[var(--card)] px-4 py-3">
          <div className="min-w-0 flex-1 text-base font-semibold">{title}</div>
          <button type="button" onClick={onClose} className="btn-ghost h-9 w-9 p-0" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/* ───────── Confirm dialog ───────── */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirmar", danger, loading, children }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description?: string; confirmLabel?: string; danger?: boolean; loading?: boolean; children?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-[var(--card)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {danger && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />}
          <div className="flex-1">
            <h2 id="confirm-title" className="text-base font-semibold">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
            {children && <div className="mt-3">{children}</div>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Checkbox / Switch ───────── */
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: string }>(({ label, description, className, id, ...props }, ref) => {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <label htmlFor={cid} className={cn("flex cursor-pointer items-start gap-2 text-sm", className)}>
      <input ref={ref} id={cid} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-400" {...props} />
      <span>
        <span>{label}</span>
        {description && <span className="block text-xs text-[var(--muted)]">{description}</span>}
      </span>
    </label>
  );
});
Checkbox.displayName = "Checkbox";

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50", checked ? "bg-brand-500" : "bg-ink-300 dark:bg-ink-700")}>
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

/* ───────── Stat card ───────── */
export function StatCard({ label, value, hint, tone, icon, href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "brand" | "red" | "green" | "amber"; icon?: ReactNode; href?: string }) {
  const tones = { brand: "text-brand-600 dark:text-brand-300", red: "text-red-600 dark:text-red-300", green: "text-emerald-600 dark:text-emerald-300", amber: "text-amber-600 dark:text-amber-300" };
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
        {icon && <span className="text-[var(--muted)]">{icon}</span>}
      </div>
      <p className={cn("mt-2 text-2xl font-bold", tone && tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card block transition hover:border-brand-300">
      {body}
    </Link>
  ) : (
    <div className="card">{body}</div>
  );
}

/* ───────── Query state helpers ───────── */
export function QueryState({ isLoading, error, children, empty, isEmpty, retry }: { isLoading: boolean; error?: unknown; children: ReactNode; empty?: ReactNode; isEmpty?: boolean; retry?: () => void }) {
  if (isLoading)
    return (
      <div className="flex items-center justify-center py-12" aria-busy="true">
        <Spinner />
      </div>
    );
  if (error) return <ErrorBox error={error} retry={retry} />;
  if (isEmpty && empty) return <>{empty}</>;
  return <>{children}</>;
}

export function ErrorBox({ error, retry, className }: { error: unknown; retry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200", className)}>
      <p className="font-medium">Não foi possível carregar.</p>
      <p className="mt-1 opacity-80">{errorMessage(error)}</p>
      {retry && (
        <Button type="button" variant="secondary" className="mt-3" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/* ───────── Search input ───────── */
export function SearchInput({ value, onChange, placeholder = "Buscar…", className, label = "Buscar" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
      <input type="search" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-9" />
    </div>
  );
}

/* ───────── Chips (multi-select) ───────── */
export function ChipSelect<T extends string>({ options, value, onChange, label }: { options: { key: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; label?: string }) {
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((o) => {
          const on = value.includes(o.key);
          return (
            <button key={o.key} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o.key) : [...value, o.key])} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Simple table ───────── */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border bg-[var(--card)]", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
export const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)] border-b";
export const td = "px-3 py-2 border-b align-middle";

/* ───────── Progress bar ───────── */
export function UsageBar({ label, used, limit, enabled = true }: { label: string; used: number; limit: number | null | undefined; enabled?: boolean }) {
  const pct = limit == null ? (used > 0 ? 8 : 0) : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tone = !enabled ? "bg-ink-300" : pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-[var(--muted)]">{!enabled ? "Indisponível" : limit == null ? `${used} · ilimitado` : `${used} / ${limit}`}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit ?? undefined} aria-label={label}>
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Avatar({ src, name, size = 36, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  const safeSrc = safeHref(src);
  return safeSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={safeSrc} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200", className)} style={{ width: size, height: size }}>
      {initials || "?"}
    </span>
  );
}

export function FieldGroup({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-[var(--muted)]">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
