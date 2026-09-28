"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Link2, MessageCircle, Trash2, Plus } from "lucide-react";
import { formatBRL, LOCATION_TYPE_LABEL, APPOINTMENT_STATUS_LABEL, type ClientInput } from "@tinypet/shared";
import { Badge, Button, Empty, Spinner } from "@/components/ui";
import { ConfirmDialog, ErrorBox, Tabs, Table, td, th } from "@/components/painel/ui";
import { ContactsEditor } from "@/components/forms/ContactsEditor";
import { useActivePartner } from "@/hooks/use-partner";
import { useApiMutation, useClient, useClientAppointments, useClientContracts } from "@/hooks/use-crm";
import { addDaysKey, dayEndISO, dayStartISO, fmtDate, fmtDateTime, fmtPhone, todayISO, whatsappLink } from "@/lib/format";
import { isForbidden } from "@/lib/errors";
import { ClientForm } from "@/components/painel/clientes/ClientForm";
import { FamilyEditor } from "@/components/painel/clientes/FamilyEditor";
import { PetsTab } from "@/components/painel/clientes/PetsTab";
import { InviteTab } from "@/components/painel/clientes/InviteTab";
import type { Client } from "@/types/api";

type Tab = "dados" | "pets" | "convite" | "contratos" | "agenda";
const TABS: { key: Tab; label: string }[] = [
  { key: "dados", label: "Dados" },
  { key: "pets", label: "Pets" },
  { key: "convite", label: "Convite" },
  { key: "contratos", label: "Contratos" },
  { key: "agenda", label: "Agenda" },
];

export default function ClientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const tab = (TABS.some((t) => t.key === sp.get("tab")) ? sp.get("tab") : "dados") as Tab;
  const setTab = (t: Tab) => router.replace(`/painel/clientes/${id}?tab=${t}`);
  const { partnerId, canSeeFinance } = useActivePartner();
  const q = useClient(id);
  const [del, setDel] = useState(false);
  const update = useApiMutation<ClientInput>({ path: () => `/clients/${id}`, method: "PATCH", body: (v) => v, invalidate: [["client", id], ["clients"]], success: "Dados salvos" });
  const remove = useApiMutation<void>({ path: () => `/clients/${id}`, method: "DELETE", invalidate: [["clients"]], success: "Cliente removido", onSuccess: () => router.push("/painel/clientes") });

  if (q.isLoading)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  if (q.error || !q.data) return <ErrorBox error={q.error ?? new Error("Cliente não encontrado")} retry={() => q.refetch()} />;
  const c = q.data;
  const phone = c.phones?.find((p) => p.type === "WHATSAPP")?.number ?? c.phones?.find((p) => p.isPrimary)?.number ?? c.phones?.[0]?.number ?? c.primaryPhone;

  return (
    <div>
      <Link href="/painel/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Clientes
      </Link>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            {c.name}
            {c.userId && (
              <Badge tone="green">
                <Link2 className="mr-1 h-3 w-3" aria-hidden /> Vinculado
              </Badge>
            )}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            {phone && (
              <span className="inline-flex items-center gap-1">
                {fmtPhone(phone)}
                <a href={whatsappLink(phone)} target="_blank" rel="noreferrer" className="text-emerald-600" aria-label="Abrir WhatsApp">
                  <MessageCircle className="h-4 w-4" />
                </a>
              </span>
            )}
            {c.source && <span>· origem: {c.source}</span>}
            {(c.tags ?? []).map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        </div>
      </header>
      <Tabs value={tab} onChange={setTab} items={TABS} className="mb-4" />

      {tab === "dados" && (
        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-3 text-base font-semibold">Dados do cliente</h2>
            <ClientForm initial={c} onSubmit={(v) => update.mutate(v)} submitting={update.isPending} />
          </section>
          <ContactsEditor base={`/clients/${id}`} phones={c.phones ?? []} emails={c.emails ?? []} addresses={c.addresses ?? []} invalidateKey={["client", id]} />
          <FamilyEditor clientId={id} initial={c.familyMembers} />
          <section className="card border-red-200 dark:border-red-900/50">
            <h2 className="text-base font-semibold text-red-700 dark:text-red-300">Zona de perigo</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">Remover o cliente esconde a ficha e os pets criados por você. Contratos e agendamentos existentes são mantidos.</p>
            <Button type="button" variant="danger" onClick={() => setDel(true)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Remover cliente
            </Button>
          </section>
          <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={() => remove.mutate()} title="Remover este cliente?" description={c.name} confirmLabel="Remover" danger loading={remove.isPending} />
        </div>
      )}
      {tab === "pets" && <PetsTab client={c} partnerId={partnerId} />}
      {tab === "convite" && <InviteTab client={c} />}
      {tab === "contratos" && <ContractsTab client={c} enabled={canSeeFinance} />}
      {tab === "agenda" && <AgendaTab client={c} />}
    </div>
  );
}

const CONTRACT_TYPE: Record<string, string> = { PACKAGE: "Pacote", RECURRING: "Recorrente", SINGLE: "Avulso", COURSE: "Curso" };
const CONTRACT_STATUS: Record<string, { label: string; tone: "gray" | "green" | "blue" | "red" }> = { DRAFT: { label: "Rascunho", tone: "gray" }, ACTIVE: { label: "Ativo", tone: "green" }, COMPLETED: { label: "Concluído", tone: "blue" }, CANCELED: { label: "Cancelado", tone: "red" } };

function ContractsTab({ client, enabled }: { client: Client; enabled: boolean }) {
  const q = useClientContracts(client.id, enabled);
  if (!enabled || isForbidden(q.error)) return <p className="card text-sm text-[var(--muted)]">Você não tem acesso ao financeiro deste parceiro. Peça ao dono para liberar.</p>;
  const items = q.data?.data ?? [];
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Link href={`/painel/financeiro/contratos/novo?clientId=${client.id}`} className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden /> Novo contrato
        </Link>
      </div>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <Empty title="Nenhum contrato" description="Crie um pacote, plano recorrente ou serviço avulso para este cliente." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Contrato</th>
              <th className={th}>Tipo</th>
              <th className={th}>Total</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((k) => (
              <tr key={k.id}>
                <td className={td}>
                  <Link href={`/painel/financeiro/contratos/${k.id}`} className="font-medium hover:underline">
                    {k.title}
                  </Link>
                  {k.createdAt && <span className="block text-xs text-[var(--muted)]">{fmtDate(k.createdAt)}</span>}
                </td>
                <td className={td}>{CONTRACT_TYPE[k.type] ?? k.type}</td>
                <td className={td}>{formatBRL(k.totalAmount)}</td>
                <td className={td}>
                  <Badge tone={CONTRACT_STATUS[k.status]?.tone ?? "gray"}>{CONTRACT_STATUS[k.status]?.label ?? k.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, "gray" | "green" | "blue" | "red" | "amber" | "brand"> = { REQUESTED: "amber", CONFIRMED: "blue", IN_PROGRESS: "brand", COMPLETED: "green", CANCELED: "red", NO_SHOW: "gray" };

function AgendaTab({ client }: { client: Client }) {
  const today = todayISO();
  const q = useClientAppointments(client.id, dayStartISO(addDaysKey(today, -90)), dayEndISO(addDaysKey(today, 180)));
  const items = [...(q.data ?? [])].sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Link href={`/painel/agenda?new=1&clientId=${client.id}`} className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden /> Novo agendamento
        </Link>
      </div>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <Empty title="Nenhum agendamento" description="Últimos 90 dias e próximos 180 dias." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Quando</th>
              <th className={th}>Serviço</th>
              <th className={`${th} hidden sm:table-cell`}>Local</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td className={td}>
                  <Link href={`/painel/agenda?view=dia&date=${a.startsAt.slice(0, 10)}&appointment=${a.id}`} className="hover:underline">
                    {fmtDateTime(a.startsAt)}
                  </Link>
                </td>
                <td className={td}>{a.item?.name ?? a.title ?? "Atendimento"}</td>
                <td className={`${td} hidden sm:table-cell`}>{LOCATION_TYPE_LABEL[a.locationType] ?? a.locationType}</td>
                <td className={td}>
                  <Badge tone={STATUS_TONE[a.status] ?? "gray"}>{APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
