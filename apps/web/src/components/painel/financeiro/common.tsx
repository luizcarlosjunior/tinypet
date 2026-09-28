"use client";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge, Spinner } from "@/components/ui";
import { useActivePartner } from "@/hooks/use-partner";
import type { Contract, Installment } from "@/types/api";
import { INSTALLMENT_STATUS_LABEL } from "@tinypet/shared";

export const CONTRACT_TYPE_LABEL: Record<Contract["type"], string> = { PACKAGE: "Pacote de sessões", RECURRING: "Plano recorrente", SINGLE: "Serviço avulso", COURSE: "Curso" };
export const CONTRACT_STATUS_LABEL: Record<Contract["status"], string> = { DRAFT: "Rascunho", ACTIVE: "Ativo", COMPLETED: "Concluído", CANCELED: "Cancelado" };
export const PERIODICITY_LABEL: Record<Contract["periodicity"], string> = { WEEKLY: "Semanal", BIWEEKLY: "Quinzenal", MONTHLY: "Mensal" };

export function ContractStatusBadge({ status }: { status: Contract["status"] }) {
  const tone = status === "ACTIVE" ? "green" : status === "COMPLETED" ? "blue" : status === "CANCELED" ? "red" : "gray";
  return <Badge tone={tone}>{CONTRACT_STATUS_LABEL[status] ?? status}</Badge>;
}
export function InstallmentStatusBadge({ status }: { status: Installment["status"] }) {
  const tone = status === "PAID" ? "green" : status === "OVERDUE" ? "red" : status === "CANCELED" ? "gray" : "amber";
  return <Badge tone={tone}>{INSTALLMENT_STATUS_LABEL[status] ?? status}</Badge>;
}

/** Wraps finance pages: waits for the partner context and blocks members without finance permission. */
export function FinanceGate({ children }: { children: React.ReactNode }) {
  const { ready, canSeeFinance, partnerId } = useActivePartner();
  if (!ready || !partnerId)
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  if (!canSeeFinance)
    return (
      <div className="card mx-auto flex max-w-lg flex-col items-center py-10 text-center">
        <Lock className="mb-3 h-8 w-8 text-[var(--muted)]" aria-hidden />
        <p className="font-semibold">Sem acesso ao financeiro</p>
        <p className="mt-1 text-sm text-[var(--muted)]">O dono do parceiro precisa liberar o financeiro para o seu usuário na página de Equipe.</p>
        <Link href="/painel" className="btn-secondary mt-4">
          Voltar ao painel
        </Link>
      </div>
    );
  return <>{children}</>;
}
