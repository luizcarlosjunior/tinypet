"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, CheckCircle2, Home, MapPin, Navigation, PawPrint, Users, Wallet, AlertCircle } from "lucide-react";
import { APPOINTMENT_STATUS_LABEL, LOCATION_TYPE_LABEL, formatBRL, mapsLinks } from "@tinypet/shared";
import { api } from "@/lib/api-client";
import { useActivePartner } from "@/hooks/use-partner";
import { useToast } from "@/components/ui/toast";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { PublishCard } from "@/components/painel/PublishCard";
import { QueryState, StatCard } from "@/components/painel/ui";
import { errorMessage } from "@/lib/errors";
import { daysLate, fmtAddress, fmtLong, fmtTime, num, todayISO, fmtDay } from "@/lib/format";
import type { Appointment, Dashboard } from "@/types/api";
import { cn } from "@/lib/utils";

const LOCATION_STYLE: Record<Appointment["locationType"], { color: string; Icon: typeof Home }> = {
  CLIENT_HOME: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200", Icon: Home },
  PARTNER_VENUE: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200", Icon: MapPin },
  OTHER: { color: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200", Icon: Navigation },
  ONLINE: { color: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200", Icon: Bell },
};
const STATUS_TONE: Record<Appointment["status"], "gray" | "green" | "red" | "amber" | "blue" | "brand"> = { REQUESTED: "amber", CONFIRMED: "blue", IN_PROGRESS: "brand", COMPLETED: "green", CANCELED: "red", NO_SHOW: "gray" };

function petsOf(a: Appointment) {
  return (a.pets ?? []).map((p) => ("pet" in p ? p.pet : p));
}

export default function DashboardPage() {
  const { partnerId, partner, membership, refresh, isOwner, canSeeFinance } = useActivePartner();
  const qc = useQueryClient();
  const { toast } = useToast();
  const dash = useQuery({ queryKey: ["dashboard", partnerId], queryFn: () => api<Dashboard>(`/partners/${partnerId}/dashboard`), enabled: !!partnerId, refetchInterval: 120_000 });
  const [missing, setMissing] = useState<string[] | null>(null);
  const publish = useMutation({
    mutationFn: () => api<{ published: boolean; missing: string[] }>(`/partners/${partnerId}/publish`, { method: "POST" }),
    onSuccess: (r) => {
      setMissing(r.missing ?? []);
      if (r.published) {
        toast("Página publicada!", "success");
        refresh();
      } else toast("Ainda faltam itens para publicar", "info");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const remind = useMutation({
    mutationFn: (id: string) => api(`/finance/installments/${id}/remind`, { method: "POST" }),
    onSuccess: () => {
      toast("Lembrete enviado", "success");
      qc.invalidateQueries({ queryKey: ["dashboard", partnerId] });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const d = dash.data;
  const overdueTotal = (d?.overdue ?? []).reduce((s, i) => s + num(i.amount) - num(i.paidAmount), 0);

  return (
    <div>
      <PageHeader title={`Olá, ${partner?.tradeName ?? membership?.partnerName ?? ""}`} description={fmtLong(new Date(), "EEEE, d 'de' MMMM 'de' yyyy")} actions={<Link href="/painel/agenda" className="btn-primary">Abrir agenda</Link>} />

      <QueryState isLoading={dash.isLoading} error={dash.error} retry={() => dash.refetch()}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Agenda de hoje" value={d?.today.length ?? 0} hint="atendimentos" icon={<CalendarDays className="h-4 w-4" />} href={`/painel/agenda?view=dia&date=${todayISO()}`} />
          {canSeeFinance && (
            <>
              <StatCard label="A receber (30 dias)" value={formatBRL(num(d?.receivable30d))} tone="brand" icon={<Wallet className="h-4 w-4" />} href="/painel/financeiro?tab=parcelas" />
              <StatCard label="Vencidas" value={formatBRL(overdueTotal)} hint={`${d?.overdue.length ?? 0} parcelas`} tone={overdueTotal > 0 ? "red" : undefined} icon={<AlertCircle className="h-4 w-4" />} href="/painel/financeiro?tab=parcelas&status=OVERDUE" />
            </>
          )}
          <StatCard label="Clientes · Pets" value={`${d?.counts.clients ?? 0} · ${d?.counts.pets ?? 0}`} hint={`${d?.counts.appointmentsWeek ?? 0} atendimentos na semana`} icon={<Users className="h-4 w-4" />} href="/painel/clientes" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Agenda do dia" actions={<Link href="/painel/agenda?view=dia" className="text-sm text-brand-600 hover:underline dark:text-brand-300">Ver agenda</Link>}>
            {(d?.today ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">Nenhum atendimento hoje.</p>
            ) : (
              <ul className="divide-y">
                {(d?.today ?? []).map((a) => {
                  const L = LOCATION_STYLE[a.locationType] ?? LOCATION_STYLE.OTHER;
                  const links = a.locationType === "CLIENT_HOME" && a.address ? mapsLinks(a.address.latitude != null ? Number(a.address.latitude) : null, a.address.longitude != null ? Number(a.address.longitude) : null, fmtAddress(a.address)) : null;
                  return (
                    <li key={a.id} className="flex flex-wrap items-start gap-3 py-3">
                      <div className="w-14 shrink-0 text-sm font-semibold tabular-nums">{fmtTime(a.startsAt)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{a.item?.name ?? a.title ?? "Atendimento"}</span>
                          <span className={cn("badge gap-1", L.color)}>
                            <L.Icon className="h-3 w-3" aria-hidden /> {LOCATION_TYPE_LABEL[a.locationType]}
                          </span>
                          <Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-[var(--muted)]">
                          {a.client?.name ?? "Sem cliente"}
                          {petsOf(a).length > 0 && (
                            <>
                              {" · "}
                              <PawPrint className="inline h-3.5 w-3.5" aria-hidden /> {petsOf(a).map((p) => p.name).join(", ")}
                            </>
                          )}
                          {a.membership?.user?.name && ` · ${a.membership.user.name}`}
                        </p>
                        {a.address && <p className="text-xs text-[var(--muted)]">{fmtAddress(a.address)}</p>}
                      </div>
                      {links && (
                        <div className="flex gap-1">
                          <a href={links.google} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-2 text-xs">
                            Google Maps
                          </a>
                          <a href={links.waze} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-2 text-xs">
                            Waze
                          </a>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="space-y-6">
            <PublishCard published={!!partner?.published} slug={partner?.slug ?? membership?.slug} missing={missing} onPublish={() => publish.mutate()} loading={publish.isPending} canPublish={isOwner} />
            {canSeeFinance && (
            <Card title="Parcelas vencidas" actions={<Link href="/painel/financeiro?tab=parcelas&status=OVERDUE" className="text-sm text-brand-600 hover:underline dark:text-brand-300">Ver todas</Link>}>
              {(d?.overdue ?? []).length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden /> Nenhuma parcela vencida.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {(d?.overdue ?? []).slice(0, 8).map((i) => (
                    <li key={i.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{i.clientName ?? i.contractTitle ?? "Parcela"}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {formatBRL(num(i.amount) - num(i.paidAmount))} · venc. {fmtDay(i.dueDate)} · <span className="text-red-600 dark:text-red-300">{i.daysLate ?? daysLate(i.dueDate)} dias de atraso</span>
                        </p>
                      </div>
                      <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => remind.mutate(i.id)} loading={remind.isPending && remind.variables === i.id}>
                        Lembrar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            )}
          </div>
        </div>
      </QueryState>
    </div>
  );
}
