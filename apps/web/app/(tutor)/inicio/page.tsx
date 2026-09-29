"use client";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, CalendarDays, CheckCircle2, Inbox, Navigation, PawPrint, Receipt } from "lucide-react";
import { useHome } from "@/hooks/use-me";
import { useSessionContext } from "@/hooks/use-session-context";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { fmtDate, fmtDateTime, toDateKey, addressLine } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { APPOINTMENT_STATUS_LABEL, formatBRL, mapsLinks } from "@tinypet/shared";
import { num } from "@/components/public/types";

export default function InicioPage() {
  const { user } = useSessionContext();
  const home = useHome();
  const qc = useQueryClient();
  const { toast } = useToast();
  const complete = useMutation({
    mutationFn: ({ petId, taskId }: { petId: string; taskId: string }) => api(`/pets/${petId}/tasks/${taskId}/complete`, { method: "POST", json: { forDate: toDateKey() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "home"] });
      toast("Tarefa concluída!", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const firstName = user?.name?.split(" ")[0];
  const d = home.data;

  return (
    <div>
      <PageHeader title={firstName ? `Olá, ${firstName}!` : "Olá!"} description={fmtDate(new Date(), "EEEE, d 'de' MMMM")} />
      {home.isLoading && <Spinner />}
      {home.isError && <Empty title="Não foi possível carregar sua página inicial" description={errorMessage(home.error)} />}
      {d && (d.pendingPetInvites ?? 0) > 0 && (
        <Link href="/convites" className="mb-4 flex items-center gap-3 rounded-2xl border border-brand-300 bg-brand-50 p-4 text-sm transition hover:shadow-md dark:border-brand-800 dark:bg-brand-900/20">
          <Inbox className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          <span className="flex-1">
            <strong>{d.pendingPetInvites === 1 ? "Você tem 1 convite de pet pendente." : `Você tem ${d.pendingPetInvites} convites de pets pendentes.`}</strong> Veja os compartilhamentos e transferências que aguardam a sua resposta.
          </span>
          <span className="font-medium text-brand-600">Ver convites</span>
        </Link>
      )}
      {d && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Tarefas de hoje" actions={<CheckCircle2 className="h-4 w-4 text-[var(--muted)]" aria-hidden />}>
            {d.tasksToday.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nada pendente para hoje. Aproveite com seus pets!</p>
            ) : (
              <ul className="divide-y">
                {d.tasksToday.map((t) => {
                  const done = !!(t.done ?? t.completed ?? t.completedAt);
                  const petName = t.petName ?? t.pet?.name;
                  return (
                    <li key={`${t.petId}-${t.id}-${t.time ?? ""}`} className="flex items-center gap-3 py-2">
                      <input
                        id={`task-${t.id}`}
                        type="checkbox"
                        checked={done}
                        disabled={done || complete.isPending}
                        onChange={() => complete.mutate({ petId: t.petId, taskId: t.id })}
                        className="h-5 w-5 accent-brand-500"
                        aria-label={`Concluir ${t.title}${petName ? ` de ${petName}` : ""}`}
                      />
                      <label htmlFor={`task-${t.id}`} className={`flex-1 text-sm ${done ? "text-[var(--muted)] line-through" : ""}`}>
                        {t.title}
                        {petName && <span className="ml-2 text-xs text-[var(--muted)]">{petName}</span>}
                      </label>
                      {(t.time ?? t.times?.[0]) && <span className="text-xs text-[var(--muted)]">{t.time ?? t.times?.join(", ")}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Próximas visitas" actions={<Link href="/agenda" className="text-xs text-brand-600 hover:underline">Ver agenda</Link>}>
            {d.upcomingAppointments.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Nenhuma visita marcada.{" "}
                <Link href="/buscar" className="text-brand-600 hover:underline">
                  Buscar parceiros
                </Link>
              </p>
            ) : (
              <ul className="divide-y">
                {d.upcomingAppointments.map((a) => {
                  const addr = a.address;
                  const links = addr ? mapsLinks(num(addr.latitude), num(addr.longitude), addressLine(addr)) : null;
                  return (
                    <li key={a.id} className="flex items-start gap-3 py-2">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.item?.name ?? a.title ?? "Visita"}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {fmtDateTime(a.startsAt)} · {a.partner?.tradeName ?? ""} · {APPOINTMENT_STATUS_LABEL[a.status]}
                        </p>
                      </div>
                      {links && (
                        <a href={links.google} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-2 text-xs" aria-label="Como chegar">
                          <Navigation className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">Como chegar</span>
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Meus pets" actions={<Link href="/pets" className="text-xs text-brand-600 hover:underline">Ver todos</Link>}>
            {d.pets.length === 0 ? (
              <Empty title="Cadastre seu primeiro pet" action={<Link href="/pets?new=1" className="btn-primary">Novo pet</Link>} />
            ) : (
              <ul className="flex flex-wrap gap-3">
                {d.pets.map((p) => (
                  <li key={p.id}>
                    <Link href={`/pets/${p.id}`} className="flex flex-col items-center gap-1 text-xs">
                      <Avatar src={p.avatarUrl} name={p.name} size={56} />
                      <span>{p.name}</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/pets?new=1" className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed text-[var(--muted)] hover:border-brand-400" aria-label="Novo pet">
                    <PawPrint className="h-5 w-5" aria-hidden />
                  </Link>
                </li>
              </ul>
            )}
          </Card>

          <Card title="Conquistas recentes" actions={<Award className="h-4 w-4 text-[var(--muted)]" aria-hidden />}>
            {d.recentBadges.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Complete a ficha, mantenha a rotina e vacinas em dia para ganhar badges.</p>
            ) : (
              <ul className="space-y-2">
                {d.recentBadges.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 text-sm">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                      <Award className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{b.badge?.name ?? b.name}</span>
                      {b.pet?.name && <span className="text-[var(--muted)]"> · {b.pet.name}</span>}
                    </span>
                    <span className="text-xs text-[var(--muted)]">{fmtDate(b.earnedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {d.overdueInstallments.length > 0 && (
            <Card title="Parcelas vencidas" className="border-red-300 lg:col-span-2" actions={<Receipt className="h-4 w-4 text-red-600" aria-hidden />}>
              <ul className="divide-y">
                {d.overdueInstallments.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="flex-1">
                      {i.contract?.title ?? "Contrato"} · parcela {i.number}
                      {i.contract?.partner?.tradeName && <span className="text-[var(--muted)]"> · {i.contract.partner.tradeName}</span>}
                    </span>
                    <span className="text-xs text-red-600">venceu em {fmtDate(i.dueDate)}</span>
                    <span className="font-semibold">{formatBRL(i.amount)}</span>
                    <Link href={`/contratos/${i.contractId}`} className="text-xs text-brand-600 hover:underline">
                      Ver
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
