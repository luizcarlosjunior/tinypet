"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { formatBRL, LOCATION_TYPE_LABEL, APPOINTMENT_STATUS_LABEL } from "@tinypet/shared";
import { Badge, Button, PageHeader, Spinner } from "@/components/ui";
import { ConfirmDialog, FieldGroup, QueryState, Table, td, th } from "@/components/painel/ui";
import { useActivePartner } from "@/hooks/use-partner";
import { useContract, useContractStatus } from "@/hooks/use-finance";
import { fmtDate, fmtDateTime, isoToDateKey, num } from "@/lib/format";
import { CONTRACT_TYPE_LABEL, ContractStatusBadge, FinanceGate, PERIODICITY_LABEL } from "@/components/painel/financeiro/common";
import { InstallmentsTable } from "@/components/painel/financeiro/InstallmentsTable";
import type { Contract } from "@/types/api";

export default function ContratoPage() {
  return (
    <FinanceGate>
      <Inner />
    </FinanceGate>
  );
}

function Inner() {
  const { partnerId } = useActivePartner();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const q = useContract(partnerId, id);
  const status = useContractStatus(id ?? "");
  const [confirm, setConfirm] = useState<Contract["status"] | null>(null);
  const c = q.data;
  const pets = (c?.pets ?? []).map((p) => ("pet" in p ? p.pet : p));
  const items = c?.items ?? [];
  const subtotal = items.reduce((a, it) => a + num(it.quantity) * num(it.unitPrice), 0);
  const paid = (c?.installments ?? []).reduce((a, i) => a + num(i.paidAmount), 0);

  return (
    <div>
      <Link href="/painel/financeiro?tab=contratos" className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Contratos
      </Link>
      <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()}>
        {!c ? (
          <Spinner />
        ) : (
          <>
            <PageHeader
              title={c.title}
              description={`${CONTRACT_TYPE_LABEL[c.type] ?? c.type} · ${c.installmentsCount}x ${PERIODICITY_LABEL[c.periodicity]?.toLowerCase() ?? ""}`}
              actions={
                <>
                  <a href={`/api/v1/finance/contracts/${c.id}/pdf?partnerId=${partnerId ?? ""}`} target="_blank" rel="noreferrer" className="btn-secondary">
                    <FileText className="h-4 w-4" aria-hidden /> Ver PDF
                  </a>
                  {c.status === "DRAFT" && (
                    <Button type="button" onClick={() => setConfirm("ACTIVE")}>
                      Ativar
                    </Button>
                  )}
                  {c.status === "ACTIVE" && (
                    <>
                      <Button type="button" variant="secondary" onClick={() => setConfirm("COMPLETED")}>
                        Concluir
                      </Button>
                      <Button type="button" variant="danger" onClick={() => setConfirm("CANCELED")}>
                        Cancelar contrato
                      </Button>
                    </>
                  )}
                  {c.status === "DRAFT" && (
                    <Button type="button" variant="ghost" onClick={() => setConfirm("CANCELED")}>
                      Descartar
                    </Button>
                  )}
                </>
              }
            />
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <ContractStatusBadge status={c.status} />
              {c.client && (
                <span>
                  Cliente:{" "}
                  <Link href={`/painel/clientes/${c.client.id}`} className="font-medium hover:underline">
                    {c.client.name}
                  </Link>
                </span>
              )}
              {pets.length > 0 && (
                <span className="flex flex-wrap items-center gap-1">
                  Pets:
                  {pets.map((p) => (
                    <Badge key={p.id} tone="gray">
                      {p.name}
                    </Badge>
                  ))}
                </span>
              )}
              {c.acceptedAt ? <Badge tone="green">Aceito pelo tutor em {fmtDateTime(c.acceptedAt)}</Badge> : <Badge tone="amber">Aguardando aceite do tutor</Badge>}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <FieldGroup title="Itens">
                  <Table>
                    <thead>
                      <tr>
                        <th className={th}>Descrição</th>
                        <th className={`${th} text-right`}>Qtd.</th>
                        <th className={`${th} text-right`}>Unitário</th>
                        <th className={`${th} text-right`}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id}>
                          <td className={td}>{it.description}</td>
                          <td className={`${td} text-right`}>{it.quantity}</td>
                          <td className={`${td} text-right tabular-nums`}>{formatBRL(it.unitPrice)}</td>
                          <td className={`${td} text-right tabular-nums`}>{formatBRL(num(it.quantity) * num(it.unitPrice))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {c.description && <p className="mt-3 whitespace-pre-line text-sm text-[var(--muted)]">{c.description}</p>}
                </FieldGroup>

                <FieldGroup title="Parcelas">
                  <InstallmentsTable items={c.installments ?? []} partnerId={partnerId} showContract={false} emptyText="Nenhuma parcela gerada." />
                </FieldGroup>

                {(c.appointments ?? []).length > 0 && (
                  <FieldGroup title="Aulas na agenda">
                    <ul className="divide-y text-sm">
                      {(c.appointments ?? []).map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                          <Link href={`/painel/agenda?view=dia&date=${isoToDateKey(a.startsAt)}`} className="font-medium hover:underline">
                            {fmtDateTime(a.startsAt)}
                          </Link>
                          {a.sessionNumber != null && <span className="text-[var(--muted)]">Sessão {a.sessionNumber}</span>}
                          <span className="text-[var(--muted)]">{LOCATION_TYPE_LABEL[a.locationType] ?? a.locationType}</span>
                          <Badge tone={a.status === "COMPLETED" ? "green" : a.status === "CANCELED" || a.status === "NO_SHOW" ? "red" : "blue"}>{APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  </FieldGroup>
                )}

                {c.terms && (
                  <FieldGroup title="Termos">
                    <p className="whitespace-pre-line text-sm">{c.terms}</p>
                  </FieldGroup>
                )}
              </div>

              <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                <FieldGroup title="Resumo">
                  <dl className="space-y-1 text-sm">
                    <Row label="Subtotal" value={formatBRL(subtotal)} />
                    <Row label="Desconto" value={`− ${formatBRL(c.discount)}`} />
                    <Row label="Total" value={formatBRL(c.totalAmount)} strong />
                    <Row label="Recebido" value={formatBRL(paid)} />
                    <Row label="Em aberto" value={formatBRL(Math.max(0, num(c.totalAmount) - paid))} />
                    <Row label="1º vencimento" value={fmtDate(c.firstDueDate)} />
                    {c.sessionsCount != null && <Row label="Sessões" value={String(c.sessionsCount)} />}
                    {c.createdAt && <Row label="Criado em" value={fmtDate(c.createdAt)} />}
                  </dl>
                </FieldGroup>
              </aside>
            </div>

            <ConfirmDialog
              open={!!confirm}
              onClose={() => setConfirm(null)}
              onConfirm={() => confirm && status.mutate(confirm, { onSuccess: () => setConfirm(null) })}
              title={confirm === "ACTIVE" ? "Ativar contrato?" : confirm === "COMPLETED" ? "Concluir contrato?" : "Cancelar contrato?"}
              description={confirm === "ACTIVE" ? "O contrato passa a contar no limite de contratos ativos do plano e o tutor será notificado para aceitar." : confirm === "COMPLETED" ? "Marque como concluído quando todas as sessões e parcelas estiverem encerradas." : "As parcelas em aberto serão canceladas. Esta ação não pode ser desfeita."}
              confirmLabel={confirm === "ACTIVE" ? "Ativar" : confirm === "COMPLETED" ? "Concluir" : "Cancelar contrato"}
              danger={confirm === "CANCELED"}
              loading={status.isPending}
            />
          </>
        )}
      </QueryState>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t pt-1 font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-[var(--muted)]"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
