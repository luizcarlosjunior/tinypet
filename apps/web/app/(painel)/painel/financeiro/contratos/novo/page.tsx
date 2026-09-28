"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui";
import { useActivePartner } from "@/hooks/use-partner";
import { FinanceGate } from "@/components/painel/financeiro/common";
import { ContractForm } from "@/components/painel/financeiro/ContractForm";

export default function NovoContratoPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <FinanceGate>
        <Inner />
      </FinanceGate>
    </Suspense>
  );
}

function Inner() {
  const { partnerId } = useActivePartner();
  const sp = useSearchParams();
  return (
    <div>
      <Link href="/painel/financeiro?tab=contratos" className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Contratos
      </Link>
      <PageHeader title="Novo contrato" description="Pacote de sessões, plano recorrente ou serviço avulso com parcelas geradas automaticamente." />
      <ContractForm partnerId={partnerId} initialClientId={sp.get("clientId")} />
    </div>
  );
}
