"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Settings2 } from "lucide-react";
import { LOCATION_TYPE_LABEL, LocationTypeEnum } from "@tinypet/shared";
import { Button, PageHeader, Select, Spinner } from "@/components/ui";
import { ErrorBox } from "@/components/painel/ui";
import { useActivePartner } from "@/hooks/use-partner";
import { useAppointments, useMembers } from "@/hooks/use-schedule";
import { addDaysKey, dayEndISO, dayStartISO, fmtDateKey, fmtLong, MONTHS, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types/api";
import { DayView, WeekView, MonthView, ListView } from "@/components/painel/agenda/views";
import { DayRoutePanel } from "@/components/painel/agenda/DayRoutePanel";
import { AppointmentModal } from "@/components/painel/agenda/AppointmentModal";
import { AppointmentDrawer } from "@/components/painel/agenda/AppointmentDrawer";
import { LOCATION_STYLE, memberName } from "@/components/painel/agenda/shared";

type View = "dia" | "semana" | "mes" | "lista";
const VIEWS: { key: View; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "lista", label: "Lista" },
];

function weekStart(d: string) {
  const dow = new Date(`${d}T12:00:00`).getDay();
  return addDaysKey(d, -dow);
}
function monthRange(d: string) {
  const month = d.slice(0, 7);
  const first = `${month}-01`;
  const firstDow = new Date(`${first}T12:00:00`).getDay();
  const gridStart = addDaysKey(first, -firstDow);
  return { from: gridStart, to: addDaysKey(gridStart, 41) };
}

export default function AgendaPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AgendaInner />
    </Suspense>
  );
}

function AgendaInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const view = (VIEWS.some((v) => v.key === sp.get("view")) ? sp.get("view") : "dia") as View;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date") ?? "") ? (sp.get("date") as string) : todayISO();
  const { partnerId } = useActivePartner();
  const members = useMembers(partnerId);
  const [membershipId, setMembershipId] = useState<string>("");
  const [locationType, setLocationType] = useState<string>("");
  const [modal, setModal] = useState<{ open: boolean; editing?: Appointment | null; clientId?: string | null }>({ open: false });
  const [selected, setSelected] = useState<Appointment | null>(null);
  const newParam = sp.get("new");
  const clientIdParam = sp.get("clientId");
  const appointmentParam = sp.get("appointment");

  // Deep links: ?new=1&clientId=… opens the modal; ?appointment=<id> opens the drawer.
  useEffect(() => {
    if (newParam === "1") {
      setModal({ open: true, clientId: clientIdParam });
      const q = new URLSearchParams(sp.toString());
      q.delete("new");
      q.delete("clientId");
      router.replace(`/painel/agenda?${q.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam, clientIdParam]);

  const setParams = (next: { view?: View; date?: string }) => {
    const q = new URLSearchParams(sp.toString());
    if (next.view) q.set("view", next.view);
    if (next.date) q.set("date", next.date);
    router.replace(`/painel/agenda?${q.toString()}`);
  };

  const range = useMemo(() => {
    if (view === "dia") return { from: date, to: date };
    if (view === "semana") {
      const s = weekStart(date);
      return { from: s, to: addDaysKey(s, 6) };
    }
    if (view === "mes") return monthRange(date);
    return { from: date, to: addDaysKey(date, 30) };
  }, [view, date]);

  const q = useAppointments({ from: dayStartISO(range.from), to: dayEndISO(range.to) }, { membershipId: membershipId || null, locationType: locationType || null }, !!partnerId);
  const items = q.data ?? [];
  useEffect(() => {
    if (appointmentParam && items.length) {
      const a = items.find((x) => x.id === appointmentParam);
      if (a) setSelected(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentParam, q.data]);

  const step = (dir: -1 | 1) => {
    if (view === "dia") return setParams({ date: addDaysKey(date, dir) });
    if (view === "semana") return setParams({ date: addDaysKey(date, 7 * dir) });
    if (view === "mes") {
      const d = new Date(`${date.slice(0, 7)}-01T12:00:00`);
      d.setMonth(d.getMonth() + dir);
      return setParams({ date: d.toISOString().slice(0, 10) });
    }
    setParams({ date: addDaysKey(date, 30 * dir) });
  };
  const title =
    view === "dia" ? fmtLong(dayStartISO(date), "EEEE, d 'de' MMMM 'de' yyyy") : view === "semana" ? `${fmtDateKey(range.from)} – ${fmtDateKey(range.to, "dd/MM/yyyy")}` : view === "mes" ? `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}` : `${fmtDateKey(range.from, "dd/MM/yyyy")} – ${fmtDateKey(range.to, "dd/MM/yyyy")}`;

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Visitas e atendimentos por pet, com rota do dia para atendimentos a domicílio."
        actions={
          <>
            <Link href="/painel/agenda/disponibilidade" className="btn-secondary">
              <Settings2 className="h-4 w-4" aria-hidden /> Disponibilidade
            </Link>
            <Button type="button" onClick={() => setModal({ open: true })}>
              <Plus className="h-4 w-4" aria-hidden /> Novo agendamento
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Visão" className="flex rounded-xl border p-0.5">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => setParams({ view: v.key })} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", view === v.key ? "bg-brand-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => step(-1)} aria-label="Anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" className="btn-secondary h-9 px-3 text-sm" onClick={() => setParams({ date: todayISO() })}>
            Hoje
          </button>
          <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => step(1)} aria-label="Próximo">
            <ChevronRight className="h-5 w-5" />
          </button>
          <input type="date" aria-label="Escolher data" value={date} onChange={(e) => e.target.value && setParams({ date: e.target.value })} className="input h-9 w-auto py-1" />
        </div>
        <h2 className="text-sm font-semibold capitalize sm:ml-2">{title}</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select aria-label="Profissional" value={membershipId} onChange={(e) => setMembershipId(e.target.value)} className="h-9 w-auto py-1">
            <option value="">Todos os profissionais</option>
            {(members.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {memberName(m)}
              </option>
            ))}
          </Select>
          <Select aria-label="Local" value={locationType} onChange={(e) => setLocationType(e.target.value)} className="h-9 w-auto py-1">
            <option value="">Todos os locais</option>
            {LocationTypeEnum.options.map((lt) => (
              <option key={lt} value={lt}>
                {LOCATION_TYPE_LABEL[lt]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]" aria-label="Legenda">
        {LocationTypeEnum.options.map((lt) => (
          <span key={lt} className="flex items-center gap-1">
            <span className={cn("h-2.5 w-2.5 rounded-full", LOCATION_STYLE[lt].dot)} aria-hidden /> {LOCATION_TYPE_LABEL[lt]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-4 rounded border border-dashed border-ink-400" aria-hidden /> Deslocamento
        </span>
      </div>

      {q.error && <ErrorBox error={q.error} retry={() => q.refetch()} className="mb-4" />}
      {q.isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}
      {!q.isLoading && (
        <div className={cn(view === "dia" && "grid gap-4 xl:grid-cols-[1fr_320px]")}>
          <div className="min-w-0">
            {view === "dia" && <DayView date={date} items={items} members={members.data ?? []} membershipId={membershipId || null} onOpen={setSelected} />}
            {view === "semana" && <WeekView start={range.from} items={items} members={members.data ?? []} onOpen={setSelected} onDay={(d) => setParams({ view: "dia", date: d })} />}
            {view === "mes" && <MonthView month={date.slice(0, 7)} items={items} onDay={(d) => setParams({ view: "dia", date: d })} />}
            {view === "lista" && <ListView items={items} members={members.data ?? []} onOpen={setSelected} />}
          </div>
          {view === "dia" && <DayRoutePanel date={date} membershipId={membershipId || null} onOpenStop={(id) => setSelected(items.find((a) => a.id === id) ?? null)} />}
        </div>
      )}

      <AppointmentModal open={modal.open} editing={modal.editing} initialClientId={modal.clientId ?? null} initialDate={view === "dia" ? date : undefined} initialMembershipId={membershipId || null} onClose={() => setModal({ open: false })} />
      <AppointmentDrawer
        appointment={selected}
        members={members.data ?? []}
        onClose={() => setSelected(null)}
        onEdit={(a) => {
          setSelected(null);
          setModal({ open: true, editing: a });
        }}
      />
    </div>
  );
}
