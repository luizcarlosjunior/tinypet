"use client";
import Link from "next/link";
import { FileText, Receipt } from "lucide-react";
import { useMyContracts, useMyInstallments, type Contract, type Installment } from "@/hooks/use-me";
import { Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { CONTRACT_STATUS_LABEL, CONTRACT_TYPE_LABEL } from "@/components/tutor/contract-labels";
import { fmtDate, fmtDay } from "@/lib/format";
import { formatBRL, INSTALLMENT_STATUS_LABEL } from "@tinypet/shared";

const STATUS_TONE = { DRAFT: "amber", ACTIVE: "green", COMPLETED: "gray", CANCELED: "red" } as const;
const INST_TONE: Record<Installment["status"], "gray" | "green" | "red" | "amber"> = { PENDING: "amber", OVERDUE: "red", PAID: "green", CANCELED: "gray" };

export default function ContratosPage() {
  const contracts = useMyContracts();
  const installments = useMyInstallments();
  const open = (installments.data ?? []).filter((i) => i.status === "PENDING" || i.status === "OVERDUE").sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div>
      <PageHeader title="Contratos e parcelas" description="Pacotes, planos recorrentes e cursos contratados" />
      {contracts.isLoading && <Spinner />}
      {contracts.isError && <Empty title="Não foi possível carregar seus contratos" description={errorMessage(contracts.error)} />}
      {contracts.data && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section aria-labelledby="lista-contratos">
            <h2 id="lista-contratos" className="sr-only">
              Contratos
            </h2>
            {contracts.data.length === 0 ? (
              <Empty title="Nenhum contrato ainda" description="Quando um parceiro criar um pacote ou plano para você, ele aparece aqui para aceite." />
            ) : (
              <ul className="space-y-3">
                {contracts.data.map((c) => (
                  <li key={c.id}>
                    <Link href={`/contratos/${c.id}`} className="card flex items-center gap-3 hover:shadow-md">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                        <FileText className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.title}</p>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {c.partner?.tradeName ?? ""} · {CONTRACT_TYPE_LABEL[c.type]} · {c.installmentsCount}x · criado em {fmtDate(c.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatBRL(Number(c.totalAmount) - Number(c.discount || 0))}</p>
                        <Badge tone={STATUS_TONE[c.status]}>{CONTRACT_STATUS_LABEL[c.status]}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Card title="Parcelas em aberto" actions={<Receipt className="h-4 w-4 text-[var(--muted)]" aria-hidden />}>
            {installments.isLoading ? (
              <Spinner />
            ) : open.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nenhuma parcela pendente. Tudo em dia!</p>
            ) : (
              <ul className="divide-y">
                {open.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        {i.contract?.title ?? "Contrato"} · {i.number}ª
                      </p>
                      <p className="text-xs text-[var(--muted)]">Vence em {fmtDay(i.dueDate)}</p>
                    </div>
                    <span className="font-semibold">{formatBRL(i.amount)}</span>
                    <Badge tone={INST_TONE[i.status]}>{INSTALLMENT_STATUS_LABEL[i.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
