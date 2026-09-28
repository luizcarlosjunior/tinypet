"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, List, Navigation, X } from "lucide-react";
import { useCancelAppointment, useMyAppointments, useRescheduleAppointment, type Appointment } from "@/hooks/use-appointments";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Button, Empty, Input, PageHeader, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { addressLine, fmtDateTime, fmtTime, toDateKey, WEEKDAYS_SHORT, MONTHS } from "@/lib/format";
import { APPOINTMENT_STATUS_LABEL, LOCATION_TYPE_LABEL, mapsLinks } from "@tinypet/shared";
import { num } from "@/components/public/types";
import { cn } from "@/lib/utils";

const TONE: Record<Appointment["status"], "gray" | "green" | "red" | "amber" | "blue" | "brand"> = { REQUESTED: "amber", CONFIRMED: "green", IN_PROGRESS: "blue", COMPLETED: "gray", CANCELED: "red", NO_SHOW: "red" };

function monthRange(y: number, m: number) {
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return { from: `${toDateKey(first)}T00:00:00-03:00`, to: `${toDateKey(last)}T23:59:59-03:00`, first, last };
}

export default function AgendaPage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [view, setView] = useState<"month" | "list">("list");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const range = useMemo(() => monthRange(ym.y, ym.m), [ym]);
  const q = useMyAppointments(range.from, range.to);
  const items = useMemo(() => [...(q.data ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [q.data]);
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of items) {
      const k = toDateKey(a.startsAt);
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return map;
  }, [items]);

  const monthLabel = `${MONTHS[ym.m]} ${ym.y}`;
  const days = useMemo(() => {
    const out: (string | null)[] = [];
    for (let i = 0; i < range.first.getDay(); i++) out.push(null);
    for (let d = 1; d <= range.last.getDate(); d++) out.push(toDateKey(new Date(ym.y, ym.m, d)));
    return out;
  }, [range, ym]);
  const today = toDateKey();

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Suas visitas e solicitações"
        actions={
          <div role="radiogroup" aria-label="Visualização" className="inline-flex rounded-xl border p-0.5">
            <button type="button" role="radio" aria-checked={view === "list"} onClick={() => setView("list")} className={cn("btn h-8 px-3 text-xs", view === "list" ? "bg-brand-500 text-white" : "")}>
              <List className="h-4 w-4" aria-hidden /> Lista
            </button>
            <button type="button" role="radio" aria-checked={view === "month"} onClick={() => setView("month")} className={cn("btn h-8 px-3 text-xs", view === "month" ? "bg-brand-500 text-white" : "")}>
              <CalendarDays className="h-4 w-4" aria-hidden /> Mês
            </button>
          </div>
        }
      />
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))} className="btn-ghost h-9 w-9 px-0" aria-label="Mês anterior">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <h2 className="text-lg font-semibold capitalize" aria-live="polite">
          {monthLabel}
        </h2>
        <button type="button" onClick={() => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))} className="btn-ghost h-9 w-9 px-0" aria-label="Próximo mês">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {q.isLoading && <Spinner />}
      {q.isError && <Empty title="Não foi possível carregar a agenda" description={errorMessage(q.error)} />}

      {q.data && view === "list" && (items.length === 0 ? (
        <Empty title="Nada marcado neste mês" description="Encontre um parceiro e solicite um horário." action={<Link href="/buscar" className="btn-primary">Buscar parceiros</Link>} />
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setSelected(a)} className="card flex w-full items-center gap-3 text-left hover:shadow-md">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-lg font-bold leading-none">{toDateKey(a.startsAt).slice(8, 10)}</p>
                  <p className="text-[11px] uppercase text-[var(--muted)]">{WEEKDAYS_SHORT[new Date(a.startsAt).getDay()]}</p>
                </div>
                <Avatar src={a.partner?.logoUrl} name={a.partner?.tradeName} size={40} square />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.item?.name ?? a.title ?? "Visita"}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {fmtTime(a.startsAt)} · {a.partner?.tradeName ?? ""}{a.pets?.length ? ` · ${a.pets.map((p) => p.pet?.name ?? p.name).filter(Boolean).join(", ")}` : ""}
                  </p>
                </div>
                <Badge tone={TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      ))}

      {q.data && view === "month" && (
        <div className="card p-2">
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-[var(--muted)]">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => (
              <div key={i} className={cn("min-h-[64px] rounded-lg border p-1 text-xs", !d && "border-transparent", d === today && "border-brand-400")}>
                {d && (
                  <>
                    <p className={cn("mb-1 text-right text-[11px]", d === today ? "font-bold text-brand-600" : "text-[var(--muted)]")}>{Number(d.slice(8, 10))}</p>
                    {(byDay.get(d) ?? []).map((a) => (
                      <button key={a.id} type="button" onClick={() => setSelected(a)} className={cn("mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[10px]", a.status === "CANCELED" ? "bg-red-100 text-red-800 line-through dark:bg-red-900/30 dark:text-red-200" : a.status === "REQUESTED" ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100" : "bg-brand-100 text-brand-900 dark:bg-brand-900/30 dark:text-brand-100")} title={`${fmtTime(a.startsAt)} ${a.item?.name ?? a.title ?? ""}`}>
                        {fmtTime(a.startsAt)} {a.item?.name ?? a.title ?? "Visita"}
                      </button>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && <AppointmentDrawer a={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AppointmentDrawer({ a, onClose }: { a: Appointment; onClose: () => void }) {
  const cancel = useCancelAppointment();
  const resched = useRescheduleAppointment();
  const { toast } = useToast();
  const [mode, setMode] = useState<"view" | "cancel" | "resched">("view");
  const [reason, setReason] = useState("");
  const [newStart, setNewStart] = useState("");
  const addr = a.address;
  const links = addr ? mapsLinks(num(addr.latitude), num(addr.longitude), addressLine(addr)) : null;
  const finished = ["COMPLETED", "CANCELED", "NO_SHOW"].includes(a.status);
  const hours = a.partner?.cancellationHours;
  const cutoffPassed = hours != null && new Date(a.startsAt).getTime() - Date.now() < hours * 3600_000;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label="Detalhes da visita">
      <aside className="h-full w-full max-w-md overflow-y-auto bg-[var(--card)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge tone={TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
            <h2 className="mt-2 text-lg font-bold">{a.item?.name ?? a.title ?? "Visita"}</h2>
            <p className="text-sm text-[var(--muted)]">{fmtDateTime(a.startsAt)} · {a.durationMinutes} min</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost h-9 w-9 px-0" aria-label="Fechar">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          {a.partner && (
            <div>
              <dt className="text-xs text-[var(--muted)]">Parceiro</dt>
              <dd className="flex items-center gap-2">
                <Avatar src={a.partner.logoUrl} name={a.partner.tradeName} size={28} square />
                <Link href={`/p/${a.partner.slug}`} className="font-medium hover:underline">
                  {a.partner.tradeName}
                </Link>
              </dd>
            </div>
          )}
          {a.pets && a.pets.length > 0 && (
            <div>
              <dt className="text-xs text-[var(--muted)]">Pets</dt>
              <dd>{a.pets.map((p) => p.pet?.name ?? p.name).filter(Boolean).join(", ")}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-[var(--muted)]">Local</dt>
            <dd>
              {LOCATION_TYPE_LABEL[a.locationType]}
              {addr && <span className="block text-[var(--muted)]">{addressLine(addr)}</span>}
              {a.locationNotes && <span className="block text-[var(--muted)]">{a.locationNotes}</span>}
            </dd>
            {links && (
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={links.google} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-3 text-xs">
                  <Navigation className="h-3.5 w-3.5" aria-hidden /> Google Maps
                </a>
                <a href={links.waze} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-3 text-xs">
                  Waze
                </a>
              </div>
            )}
          </div>
          {a.membership?.user?.name && (
            <div>
              <dt className="text-xs text-[var(--muted)]">Profissional</dt>
              <dd>{a.membership.user.name}</dd>
            </div>
          )}
          {a.notes && (
            <div>
              <dt className="text-xs text-[var(--muted)]">Observações</dt>
              <dd className="whitespace-pre-line">{a.notes}</dd>
            </div>
          )}
          {a.report && (
            <div>
              <dt className="text-xs text-[var(--muted)]">Relato do atendimento</dt>
              <dd className="whitespace-pre-line">{a.report}</dd>
            </div>
          )}
          {a.cancelReason && (
            <div>
              <dt className="text-xs text-[var(--muted)]">Motivo do cancelamento</dt>
              <dd>{a.cancelReason}</dd>
            </div>
          )}
        </dl>

        {!finished && mode === "view" && (
          <div className="mt-6 space-y-2">
            {cutoffPassed && <p className="text-xs text-amber-700 dark:text-amber-300">O prazo de cancelamento gratuito ({hours} h antes) já passou. O parceiro pode recusar o cancelamento.</p>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setMode("resched")}>
                Pedir outro horário
              </Button>
              <Button type="button" variant="danger" onClick={() => setMode("cancel")} disabled={cutoffPassed && hours != null && hours > 0 && false}>
                Cancelar visita
              </Button>
            </div>
          </div>
        )}
        {mode === "cancel" && (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              cancel
                .mutateAsync({ id: a.id, reason })
                .then(() => {
                  toast("Visita cancelada.", "info");
                  onClose();
                })
                .catch((err) => toast(errorMessage(err, "Não foi possível cancelar: o prazo do parceiro já passou."), "error"));
            }}
          >
            <Textarea id="cancel-reason" label="Motivo do cancelamento" value={reason} onChange={(e) => setReason(e.target.value)} required />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setMode("view")}>
                Voltar
              </Button>
              <Button type="submit" variant="danger" loading={cancel.isPending} disabled={!reason.trim()}>
                Confirmar cancelamento
              </Button>
            </div>
          </form>
        )}
        {mode === "resched" && (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              resched
                .mutateAsync({ id: a.id, startsAt: new Date(newStart).toISOString() })
                .then(() => {
                  toast("Pedido de novo horário enviado ao parceiro.", "success");
                  onClose();
                })
                .catch((err) => toast(errorMessage(err), "error"));
            }}
          >
            <Input id="resched-start" type="datetime-local" label="Novo horário desejado" value={newStart} onChange={(e) => setNewStart(e.target.value)} required />
            <p className="text-xs text-[var(--muted)]">O parceiro recebe uma nova solicitação e confirma se houver disponibilidade.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setMode("view")}>
                Voltar
              </Button>
              <Button type="submit" loading={resched.isPending} disabled={!newStart}>
                Enviar pedido
              </Button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
