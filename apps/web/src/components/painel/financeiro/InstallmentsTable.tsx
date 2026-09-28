"use client";
import { useState, Fragment } from "react";
import Link from "next/link";
import { Bell, ChevronDown, ChevronRight, CircleDollarSign, Trash2 } from "lucide-react";
import { formatBRL, PAYMENT_METHOD_LABEL } from "@tinypet/shared";
import { Button } from "@/components/ui";
import { ConfirmDialog, Table, td, th } from "@/components/painel/ui";
import { useDeletePayment, useRemindInstallment } from "@/hooks/use-finance";
import { daysLate, fmtDate, num } from "@/lib/format";
import type { Installment } from "@/types/api";
import { InstallmentStatusBadge } from "./common";
import { PaymentModal } from "./PaymentModal";

/** Row actions for a single installment: "Baixar" + "Lembrar". */
export function InstallmentActions({ inst, onPay }: { inst: Installment; onPay: (i: Installment) => void }) {
  const remind = useRemindInstallment();
  const openStatus = inst.status === "PENDING" || inst.status === "OVERDUE";
  if (!openStatus) return null;
  return (
    <div className="flex justify-end gap-1">
      <Button type="button" variant="primary" className="h-8 px-2 text-xs" onClick={() => onPay(inst)}>
        <CircleDollarSign className="h-4 w-4" aria-hidden /> Baixar
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2 text-xs" loading={remind.isPending && remind.variables === inst.id} onClick={() => remind.mutate(inst.id)} title={inst.reminderSentAt ? `Último lembrete em ${fmtDate(inst.reminderSentAt)}` : "Enviar lembrete ao tutor"}>
        <Bell className="h-4 w-4" aria-hidden /> Lembrar
      </Button>
    </div>
  );
}

/** Installments table with expandable payment history, "Baixar", "Lembrar" and "Estornar". */
export function InstallmentsTable({ items, partnerId, showContract = true, emptyText = "Nenhuma parcela encontrada." }: { items: Installment[]; partnerId: string | null; showContract?: boolean; emptyText?: string }) {
  const [paying, setPaying] = useState<Installment | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [delPayment, setDelPayment] = useState<string | null>(null);
  const del = useDeletePayment();
  const cols = showContract ? 7 : 6;
  return (
    <>
      <Table>
        <thead>
          <tr>
            <th className={th} style={{ width: 32 }}>
              <span className="sr-only">Detalhes</span>
            </th>
            {showContract && <th className={th}>Contrato / cliente</th>}
            <th className={th}>Parcela</th>
            <th className={th}>Vencimento</th>
            <th className={`${th} text-right`}>Valor</th>
            <th className={`${th} text-right`}>Pago</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td className={`${td} text-center text-[var(--muted)]`} colSpan={cols + 1}>
                {emptyText}
              </td>
            </tr>
          )}
          {items.map((i) => {
            const late = i.status === "OVERDUE" ? daysLate(i.dueDate) : 0;
            const expanded = !!open[i.id];
            const payments = i.payments ?? [];
            return (
              <Fragment key={i.id}>
                <tr className={i.status === "OVERDUE" ? "bg-red-50/60 dark:bg-red-900/10" : undefined}>
                  <td className={td}>
                    <button type="button" className="btn-ghost h-7 w-7 p-0" aria-expanded={expanded} aria-label={expanded ? "Ocultar pagamentos" : "Ver pagamentos"} onClick={() => setOpen((o) => ({ ...o, [i.id]: !expanded }))}>
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  {showContract && (
                    <td className={td}>
                      <Link href={`/painel/financeiro/contratos/${i.contractId}`} className="font-medium hover:underline">
                        {i.contract?.title ?? "Contrato"}
                      </Link>
                      {i.contract?.client && <span className="block text-xs text-[var(--muted)]">{i.contract.client.name}</span>}
                    </td>
                  )}
                  <td className={td}>
                    {i.number}
                    {i.contract?.installmentsCount ? `/${i.contract.installmentsCount}` : ""}
                  </td>
                  <td className={td}>
                    {fmtDate(i.dueDate)}
                    {late > 0 && <span className="block text-xs font-medium text-red-600 dark:text-red-300">{late} {late === 1 ? "dia" : "dias"} em atraso</span>}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{formatBRL(i.amount)}</td>
                  <td className={`${td} text-right tabular-nums`}>{num(i.paidAmount) > 0 ? formatBRL(i.paidAmount) : "—"}</td>
                  <td className={td}>
                    <InstallmentStatusBadge status={i.status} />
                  </td>
                  <td className={td}>
                    <InstallmentActions inst={i} onPay={setPaying} />
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td className={`${td} bg-ink-50 dark:bg-ink-900/40`} colSpan={cols + 1}>
                      {payments.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">Nenhum pagamento registrado nesta parcela.</p>
                      ) : (
                        <ul className="divide-y text-xs">
                          {payments.map((p) => (
                            <li key={p.id} className="flex flex-wrap items-center gap-3 py-1.5">
                              <span className="font-medium tabular-nums">{formatBRL(p.amount)}</span>
                              <span>{fmtDate(p.paidAt)}</span>
                              <span className="text-[var(--muted)]">{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method}</span>
                              {p.receiptUrl && (
                                <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline dark:text-brand-300">
                                  Comprovante
                                </a>
                              )}
                              {p.notes && <span className="text-[var(--muted)]">{p.notes}</span>}
                              <button type="button" className="ml-auto inline-flex items-center gap-1 text-red-600 hover:underline" onClick={() => setDelPayment(p.id)}>
                                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Estornar
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </Table>
      <PaymentModal installment={paying} onClose={() => setPaying(null)} partnerId={partnerId} />
      <ConfirmDialog open={!!delPayment} onClose={() => setDelPayment(null)} onConfirm={() => delPayment && del.mutate(delPayment, { onSuccess: () => setDelPayment(null) })} title="Estornar pagamento?" description="O valor será removido da parcela e o status recalculado." confirmLabel="Estornar" danger loading={del.isPending} />
    </>
  );
}
