"use client";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { QueryState } from "@/components/painel/ui";
import { isForbidden } from "@/lib/errors";
import { ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { DEFAULT_QUALITY } from "@/lib/blog-media";

/** QueryState that explains a missing blog endpoint (404 while the API is not deployed) instead of a raw error. */
export function BlogQueryState({ isLoading, error, retry, children, isEmpty, empty }: { isLoading: boolean; error?: unknown; retry?: () => void; children: ReactNode; isEmpty?: boolean; empty?: ReactNode }) {
  if (!isLoading && error && (isApiMissing(error) || isForbidden(error))) {
    return <ApiNotice forbidden={isForbidden(error)} />;
  }
  return (
    <QueryState isLoading={isLoading} error={error} retry={retry} isEmpty={isEmpty} empty={empty}>
      {children}
    </QueryState>
  );
}

/** 404 with a non-JSON body = the route itself is not deployed yet (vs. a JSON NOT_FOUND for a missing record). */
export function isApiMissing(e: unknown) {
  return e instanceof ApiClientError && e.status === 404 && e.code === "NETWORK";
}

export function ApiNotice({ forbidden, className }: { forbidden?: boolean; className?: string }) {
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100", className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">{forbidden ? "Sem permissão para este recurso." : "API do blog indisponível."}</p>
        <p className="mt-0.5 opacity-80">{forbidden ? "Sua conta precisa do papel Admin ou Editor do blog." : "O endpoint ainda não respondeu (404). Tente novamente em instantes."}</p>
      </div>
    </div>
  );
}

/** 1–100 quality slider with a "Padrão (85%)" reset, like the reference. */
export function QualitySlider({ value, onChange, disabled, label = "Qualidade WebP", id }: { value: number; onChange: (v: number) => void; disabled?: boolean; label?: string; id: string }) {
  return (
    <div className="space-y-1.5 rounded-xl border bg-ink-50/50 px-3 py-2 dark:bg-ink-900/30">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm">
          {label}: <strong>{value}%</strong>
        </label>
        {value !== DEFAULT_QUALITY && (
          <button type="button" className="text-xs text-brand-600 hover:underline dark:text-brand-300" onClick={() => onChange(DEFAULT_QUALITY)} disabled={disabled}>
            Padrão ({DEFAULT_QUALITY}%)
          </button>
        )}
      </div>
      <input id={id} type="range" min={1} max={100} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} className="w-full accent-brand-500" />
      <p className="text-xs text-[var(--muted)]">Valores entre 75–85 oferecem boa qualidade com ótima compressão.</p>
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export const fmtInt = (n: number | null | undefined) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
