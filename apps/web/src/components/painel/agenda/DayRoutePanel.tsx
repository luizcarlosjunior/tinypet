"use client";
import { AlertTriangle, ExternalLink, Route } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { fmtKm, fmtMinutes, fmtTime } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { useApplySuggestion, useDayRoute } from "@/hooks/use-schedule";
import { cn } from "@/lib/utils";
import { safeHref } from "@tinypet/shared";

export function DayRoutePanel({ date, membershipId, onOpenStop }: { date: string; membershipId: string | null; onOpenStop?: (appointmentId: string) => void }) {
  const q = useDayRoute(date, membershipId);
  const apply = useApplySuggestion();
  const r = q.data;
  return (
    <aside className="card" aria-labelledby="route-title">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id="route-title" className="flex items-center gap-2 text-sm font-semibold">
          <Route className="h-4 w-4" aria-hidden /> Rota do dia
        </h2>
        {r?.googleMapsUrl && (
          <a href={safeHref(r.googleMapsUrl)} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-2 text-xs">
            <ExternalLink className="h-3 w-3" aria-hidden /> Abrir no Google Maps
          </a>
        )}
      </header>
      {!membershipId && <p className="mb-2 text-xs text-[var(--muted)]">Sem filtro, mostra a sua rota. Escolha um profissional para ver a rota dele.</p>}
      {q.isLoading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
      {q.error && <p className="text-sm text-[var(--muted)]">Rota indisponível: {errorMessage(q.error)}</p>}
      {r && r.stops.length === 0 && <p className="text-sm text-[var(--muted)]">Nenhuma visita a domicílio neste dia.</p>}
      {r && r.stops.length > 0 && (
        <>
          <ol className="space-y-2">
            {r.stops.map((s) => (
              <li key={s.appointmentId} className={cn("rounded-xl border p-2 text-sm", s.alert && "border-red-400 bg-red-50 dark:bg-red-900/20")}>
                <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => onOpenStop?.(s.appointmentId)}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white" aria-label={`Parada ${s.order}`}>
                    {s.order}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{fmtTime(s.startsAt)}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">{s.clientName ? `${s.clientName} · ` : ""}{s.addressText ?? "Endereço não informado"}</span>
                    {(s.legDistanceKm != null || s.legMinutes != null) && (
                      <span className="block text-xs">
                        Trecho: {s.legDistanceKm != null ? fmtKm(s.legDistanceKm) : "—"} · {s.legMinutes != null ? fmtMinutes(s.legMinutes) : "—"}
                        {s.estimated && <span className="text-[var(--muted)]"> (estimativa)</span>}
                      </span>
                    )}
                    {s.alert && (
                      <span className="mt-1 flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300">
                        <AlertTriangle className="h-3 w-3" aria-hidden /> {s.alert.message}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm">
            <strong>Total:</strong> {fmtKm(r.totalKm)} · {fmtMinutes(r.totalMinutes)} ao volante
          </p>
          {r.suggestions && r.suggestions.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Sugestões</h3>
              <ul className="space-y-2">
                {r.suggestions.map((s, i) => {
                  const changes = s.type === "SHIFT" ? [{ appointmentId: s.appointmentId, startsAt: s.suggestedStartsAt }] : [];
                  return (
                  <li key={i} className="rounded-xl bg-ink-50 p-2 text-sm dark:bg-ink-800/60">
                    <p className="font-medium">{s.type === "SHIFT" ? "Ajustar horário" : "Reordenar visitas"}</p>
                    <p className="text-xs text-[var(--muted)]">{s.message}</p>
                    {s.type === "REORDER" && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Economia: {fmtKm(s.savesKm)} · {fmtMinutes(s.savesMinutes)}
                      </p>
                    )}
                    {changes.length > 0 ? (
                      <Button type="button" variant="secondary" className="mt-2 h-8 text-xs" loading={apply.isPending} onClick={() => apply.mutate(changes)}>
                        Aplicar
                      </Button>
                    ) : (
                      <p className="mt-1 text-[11px] text-[var(--muted)]">Somente leitura — ajuste os horários manualmente.</p>
                    )}
                  </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-[var(--muted)]">Se o horário combinado com o tutor mudar, ele recebe a proposta e precisa aceitar.</p>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
