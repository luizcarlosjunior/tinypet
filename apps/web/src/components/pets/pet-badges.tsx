"use client";
import { Award, Lock } from "lucide-react";
import { usePetResource } from "@/hooks/use-pets";
import { Spinner } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { SYSTEM_BADGES, safeHref } from "@tinypet/shared";
import { cn } from "@/lib/utils";

type Earned = { id?: string; badgeId?: string; earnedAt?: string | null; badge?: { key: string; name: string; description: string | null; iconUrl: string | null; partner?: { tradeName: string } | null } | null; key?: string; name?: string; description?: string | null; iconUrl?: string | null; earned?: boolean };

export function PetBadges({ petId }: { petId: string }) {
  const q = usePetResource<Earned[]>(petId, "badges");
  if (q.isLoading) return <Spinner />;
  const rows = q.data ?? [];
  const norm = rows.map((r) => ({ key: r.badge?.key ?? r.key ?? r.badgeId ?? "", name: r.badge?.name ?? r.name ?? "", description: r.badge?.description ?? r.description ?? null, iconUrl: r.badge?.iconUrl ?? r.iconUrl ?? null, earnedAt: r.earnedAt ?? null, earned: r.earned ?? !!r.earnedAt, partner: r.badge?.partner?.tradeName }));
  const earnedKeys = new Set(norm.filter((b) => b.earned).map((b) => b.key));
  const all = [...norm.filter((b) => b.earned), ...SYSTEM_BADGES.filter((s) => !earnedKeys.has(s.key) && !norm.some((n) => n.key === s.key)).map((s) => ({ key: s.key, name: s.name, description: s.description, iconUrl: null, earnedAt: null, earned: false, partner: undefined })), ...norm.filter((b) => !b.earned)];
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {all.map((b) => (
        <li key={b.key} className={cn("card flex items-center gap-3", !b.earned && "opacity-60")}>
          <span className={cn("inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full", b.earned ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" : "bg-ink-100 text-ink-500 dark:bg-ink-800")}>
            {b.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={safeHref(b.iconUrl)} alt="" className="h-8 w-8" />
            ) : b.earned ? (
              <Award className="h-6 w-6" aria-hidden />
            ) : (
              <Lock className="h-5 w-5" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{b.name}</p>
            {b.description && <p className="text-xs text-[var(--muted)]">{b.description}</p>}
            <p className="mt-0.5 text-xs text-[var(--muted)]">{b.earned ? `Conquistada em ${fmtDate(b.earnedAt)}` : "Ainda não conquistada"}{b.partner ? ` · ${b.partner}` : ""}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
