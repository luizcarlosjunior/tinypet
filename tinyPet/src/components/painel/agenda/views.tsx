"use client";
import { useMemo } from "react";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDaysKey, fmtDateKey, fmtTime, isoToDateKey, isoToMinutes, todayISO, WEEKDAYS_SHORT } from "@/lib/format";
import { Table, th, td } from "@/components/painel/ui";
import { Empty } from "@/components/ui";
import type { Appointment, TeamMember } from "@/types/api";
import { AppointmentCard, LOCATION_STYLE, StatusBadge, apptPets, apptTitle, memberName, LocationChip } from "./shared";

const START_H = 6;
const END_H = 22;
const PX_PER_MIN = 1.5;
const HOURS = Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i);

function top(iso: string) {
  return Math.max(0, (isoToMinutes(iso) - START_H * 60) * PX_PER_MIN);
}
function height(startIso: string, endIso: string) {
  const s = Math.max(START_H * 60, isoToMinutes(startIso));
  const e = Math.min(END_H * 60, isoToMinutes(endIso));
  return Math.max(18, (e - s) * PX_PER_MIN);
}

/* ───────── Day view ───────── */
export function DayView({ date, items, members, membershipId, onOpen }: { date: string; items: Appointment[]; members: TeamMember[]; membershipId: string | null; onOpen: (a: Appointment) => void }) {
  const dayItems = items.filter((a) => isoToDateKey(a.startsAt) === date);
  const columns = useMemo(() => {
    if (membershipId) return [{ id: membershipId, label: memberName(members.find((m) => m.id === membershipId)), items: dayItems }];
    const cols = members.map((m) => ({ id: m.id, label: memberName(m), items: dayItems.filter((a) => a.membershipId === m.id) }));
    const orphan = dayItems.filter((a) => !a.membershipId || !members.some((m) => m.id === a.membershipId));
    if (orphan.length || cols.length === 0) cols.push({ id: "none", label: "Sem profissional", items: orphan });
    return cols;
  }, [dayItems, members, membershipId]);
  const totalH = (END_H - START_H) * 60 * PX_PER_MIN;
  const now = todayISO() === date ? (isoToMinutes(new Date()) - START_H * 60) * PX_PER_MIN : null;

  return (
    <div className="overflow-x-auto rounded-2xl border bg-[var(--card)]">
      <div className="flex min-w-max">
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r bg-[var(--card)]">
          <div className="h-10 border-b" />
          <div className="relative" style={{ height: totalH }}>
            {HOURS.map((h) => (
              <span key={h} className="absolute -translate-y-1/2 pl-2 text-xs text-[var(--muted)]" style={{ top: (h - START_H) * 60 * PX_PER_MIN }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.id} className="w-64 shrink-0 border-r last:border-r-0 md:w-72">
            <div className="flex h-10 items-center border-b px-3 text-sm font-semibold">
              <span className="truncate">{col.label}</span>
              <span className="ml-auto text-xs font-normal text-[var(--muted)]">{col.items.length}</span>
            </div>
            <div className="relative" style={{ height: totalH }}>
              {HOURS.map((h) => (
                <div key={h} className="absolute left-0 right-0 border-t border-dashed" style={{ top: (h - START_H) * 60 * PX_PER_MIN }} aria-hidden />
              ))}
              {now != null && now >= 0 && now <= totalH && <div className="absolute left-0 right-0 z-10 border-t-2 border-red-500" style={{ top: now }} aria-label="Agora" />}
              {col.items.map((a) => {
                const s = LOCATION_STYLE[a.locationType] ?? LOCATION_STYLE.OTHER;
                const leg = a.travelLeg;
                return (
                  <div key={a.id}>
                    {leg && (
                      <div
                        className="absolute left-1 right-1 flex items-center gap-1 overflow-hidden rounded-md border border-dashed border-ink-400 px-1 text-[10px] text-ink-700 dark:text-ink-200"
                        style={{ top: top(leg.startsAt), height: height(leg.startsAt, leg.endsAt), backgroundImage: "repeating-linear-gradient(135deg, rgba(120,120,140,.18) 0 4px, transparent 4px 8px)" }}
                        title={`Deslocamento ${leg.durationMinutes} min · ${Number(leg.distanceKm).toFixed(1)} km`}
                      >
                        <Car className="h-3 w-3 shrink-0" aria-hidden /> {leg.durationMinutes} min{leg.estimated ? " (est.)" : ""}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpen(a)}
                      className={cn("absolute left-1 right-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs shadow-sm transition hover:z-20 hover:shadow-md focus:z-20 focus:outline-none focus:ring-2 focus:ring-brand-400", s.block, (a.status === "CANCELED" || a.status === "NO_SHOW") && "opacity-50")}
                      style={{ top: top(a.startsAt), height: height(a.startsAt, a.endsAt) }}
                      aria-label={`${fmtTime(a.startsAt)} ${apptTitle(a)} ${a.client?.name ?? ""} ${s.label}`}
                    >
                      <span className="flex items-center gap-1 font-semibold">
                        {fmtTime(a.startsAt)} <LocationChip type={a.locationType} short className="px-1 py-0" />
                      </span>
                      <span className="block truncate font-medium">{apptTitle(a)}</span>
                      <span className="block truncate opacity-80">
                        {a.client?.name ?? ""}
                        {apptPets(a).length ? ` · ${apptPets(a).map((p) => p.name).join(", ")}` : ""}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Week view ───────── */
export function WeekView({ start, items, members, onOpen, onDay }: { start: string; items: Appointment[]; members: TeamMember[]; onOpen: (a: Appointment) => void; onDay: (d: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
  const today = todayISO();
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {days.map((d) => {
        const list = items.filter((a) => isoToDateKey(a.startsAt) === d).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        const dow = new Date(`${d}T12:00:00`).getDay();
        return (
          <section key={d} className={cn("rounded-2xl border bg-[var(--card)] p-2", d === today && "ring-2 ring-brand-300")}>
            <button type="button" onClick={() => onDay(d)} className="mb-2 flex w-full items-baseline justify-between rounded-lg px-1 text-sm hover:bg-ink-100 dark:hover:bg-ink-800" aria-label={`Ver dia ${fmtDateKey(d)}`}>
              <span className="font-semibold">{WEEKDAYS_SHORT[dow]}</span>
              <span className="text-[var(--muted)]">{fmtDateKey(d)}</span>
            </button>
            <div className="space-y-1.5">
              {list.length === 0 && <p className="px-1 py-2 text-xs text-[var(--muted)]">—</p>}
              {list.map((a) => (
                <AppointmentCard key={a.id} a={a} compact onClick={() => onOpen(a)} members={members} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ───────── Month view ───────── */
export function MonthView({ month, items, onDay }: { month: string; items: Appointment[]; onDay: (d: string) => void }) {
  const first = `${month}-01`;
  const firstDow = new Date(`${first}T12:00:00`).getDay();
  const gridStart = addDaysKey(first, -firstDow);
  const cells = Array.from({ length: 42 }, (_, i) => addDaysKey(gridStart, i));
  const today = todayISO();
  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of items) {
      const k = isoToDateKey(a.startsAt);
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  }, [items]);
  return (
    <div className="overflow-hidden rounded-2xl border bg-[var(--card)]">
      <div className="grid grid-cols-7 border-b text-center text-xs font-semibold text-[var(--muted)]">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const inMonth = d.startsWith(month);
          const list = (byDay.get(d) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          return (
            <button key={d} type="button" onClick={() => onDay(d)} className={cn("min-h-[84px] border-b border-r p-1 text-left align-top transition hover:bg-ink-50 dark:hover:bg-ink-800/60", !inMonth && "bg-ink-50/60 text-[var(--muted)] dark:bg-ink-900/40")} aria-label={`${fmtDateKey(d, "dd/MM/yyyy")}, ${list.length} agendamentos`}>
              <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", d === today && "bg-brand-500 font-bold text-white")}>{Number(d.slice(8, 10))}</span>
              <div className="mt-1 space-y-0.5">
                {list.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center gap-1 truncate text-[11px]">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", LOCATION_STYLE[a.locationType]?.dot)} aria-hidden />
                    <span className="truncate">
                      {fmtTime(a.startsAt)} {a.client?.name ?? apptTitle(a)}
                    </span>
                  </div>
                ))}
                {list.length > 3 && <p className="text-[11px] text-[var(--muted)]">+{list.length - 3}</p>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── List view ───────── */
export function ListView({ items, members, onOpen }: { items: Appointment[]; members: TeamMember[]; onOpen: (a: Appointment) => void }) {
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (!sorted.length) return <Empty title="Nenhum agendamento no período" description="Crie um novo agendamento ou mude o período." />;
  return (
    <Table>
      <thead>
        <tr>
          <th className={th}>Data</th>
          <th className={th}>Horário</th>
          <th className={th}>Atendimento</th>
          <th className={th}>Cliente / pets</th>
          <th className={th}>Profissional</th>
          <th className={th}>Local</th>
          <th className={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((a) => (
          <tr key={a.id} className="cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/60" onClick={() => onOpen(a)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(a)}>
            <td className={td}>{fmtDateKey(isoToDateKey(a.startsAt), "EEE dd/MM")}</td>
            <td className={td}>
              {fmtTime(a.startsAt)}–{fmtTime(a.endsAt)}
            </td>
            <td className={cn(td, "font-medium")}>{apptTitle(a)}</td>
            <td className={td}>
              {a.client?.name ?? "—"}
              {apptPets(a).length > 0 && <span className="block text-xs text-[var(--muted)]">{apptPets(a).map((p) => p.name).join(", ")}</span>}
            </td>
            <td className={td}>{memberName(members.find((m) => m.id === a.membershipId)) || "—"}</td>
            <td className={td}>
              <LocationChip type={a.locationType} />
            </td>
            <td className={td}>
              <StatusBadge status={a.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
