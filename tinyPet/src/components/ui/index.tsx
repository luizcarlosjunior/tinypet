"use client";
import { cn } from "@/lib/utils";
import { forwardRef, useEffect, useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { Loader2, X } from "lucide-react";

// Literal class names: Tailwind drops @layer components classes it can't find verbatim in the source (`btn-${v}` isn't).
const BUTTON_CLASS = { primary: "btn-primary", secondary: "btn-secondary", ghost: "btn-ghost", danger: "btn-danger" } as const;

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_CLASS; loading?: boolean }>(
  ({ className, variant = "primary", loading, children, disabled, ...props }, ref) => (
    <button ref={ref} className={cn(BUTTON_CLASS[variant], className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(({ className, label, error, id, ...props }, ref) => (
  <div>
    {label && (
      <label htmlFor={id} className="label">
        {label}
      </label>
    )}
    <input ref={ref} id={id} className={cn("input", error && "border-red-500", className)} aria-invalid={!!error} {...props} />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }>(({ className, label, error, id, ...props }, ref) => (
  <div>
    {label && (
      <label htmlFor={id} className="label">
        {label}
      </label>
    )}
    <textarea ref={ref} id={id} className={cn("input min-h-[90px]", error && "border-red-500", className)} {...props} />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }>(({ className, label, error, id, children, ...props }, ref) => (
  <div>
    {label && (
      <label htmlFor={id} className="label">
        {label}
      </label>
    )}
    <select ref={ref} id={id} className={cn("input", error && "border-red-500", className)} {...props}>
      {children}
    </select>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Select.displayName = "Select";

export function Card({ className, children, title, actions }: { className?: string; children: React.ReactNode; title?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "gray", className }: { children: React.ReactNode; tone?: "gray" | "green" | "red" | "amber" | "blue" | "brand"; className?: string }) {
  const tones = {
    gray: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    brand: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200",
  };
  return <span className={cn("badge", tones[tone], className)}>{children}</span>;
}

export function Empty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center py-10 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-[var(--muted)]", className)} aria-label="Carregando" />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** Dialog: closes on Escape and the ✕ button (both go through `onClose`, so callers can block it while busy) — never on an outside click, so a half-filled form isn't lost. */
export function Modal({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; className?: string }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}>
      <div className={cn("max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-[var(--card)] p-5 sm:max-w-lg sm:rounded-2xl", className)} onClick={(e) => e.stopPropagation()}>
        <div className={cn("flex items-start justify-between gap-3", title ? "mb-4" : "-mb-2")}>
          {title ? (
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="btn-ghost -mr-2 -mt-1 h-8 w-8 shrink-0 px-0" aria-label="Fechar">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
