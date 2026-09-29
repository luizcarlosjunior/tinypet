"use client";

/** Horizontal bar list for grouped counts. Non-numeric counts (e.g. "menos de 5") are shown as text. */
export function BarList({ groups, label }: { groups: { key: string; count: number | string }[]; label: string }) {
  const max = Math.max(1, ...groups.map((g) => (typeof g.count === "number" ? g.count : 0)));
  if (!groups.length) return <p className="text-sm text-[var(--muted)]">Sem dados para agrupar.</p>;
  return (
    <ul className="space-y-2" aria-label={label}>
      {groups.map((g) => {
        const n = typeof g.count === "number" ? g.count : null;
        const pct = n == null ? 4 : Math.max(2, Math.round((n / max) * 100));
        return (
          <li key={g.key} className="text-sm">
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <span className="truncate">{g.key || "—"}</span>
              <span className="shrink-0 text-xs text-[var(--muted)]">{n == null ? g.count : n}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" aria-hidden>
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
