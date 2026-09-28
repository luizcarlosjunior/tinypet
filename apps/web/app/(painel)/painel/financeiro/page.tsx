"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Spinner } from "@/components/ui";
import { Tabs } from "@/components/painel/ui";
import { useActivePartner } from "@/hooks/use-partner";
import { FinanceGate } from "@/components/painel/financeiro/common";
import { ResumoTab } from "@/components/painel/financeiro/ResumoTab";
import { ContratosTab } from "@/components/painel/financeiro/ContratosTab";
import { ParcelasTab } from "@/components/painel/financeiro/ParcelasTab";
import { LancamentosTab } from "@/components/painel/financeiro/LancamentosTab";
import { ExportarTab } from "@/components/painel/financeiro/ExportarTab";

type Tab = "resumo" | "contratos" | "parcelas" | "lancamentos" | "exportar";
const TABS: { key: Tab; label: string }[] = [
  { key: "resumo", label: "Resumo" },
  { key: "contratos", label: "Contratos" },
  { key: "parcelas", label: "Parcelas" },
  { key: "lancamentos", label: "Lançamentos" },
  { key: "exportar", label: "Exportar" },
];

export default function FinanceiroPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <FinanceGate>
        <FinanceiroInner />
      </FinanceGate>
    </Suspense>
  );
}

function FinanceiroInner() {
  const { partnerId } = useActivePartner();
  const sp = useSearchParams();
  const router = useRouter();
  const raw = sp.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.some((t) => t.key === raw) ? raw : "resumo";
  const setTab = (t: Tab) => router.replace(`/painel/financeiro?tab=${t}`, { scroll: false });
  return (
    <div>
      <PageHeader title="Financeiro" description="Contratos, parcelas e caixa do seu negócio. Cobrança online chega em breve." />
      <Tabs value={tab} onChange={setTab} items={TABS} className="mb-4" />
      {tab === "resumo" && <ResumoTab partnerId={partnerId} />}
      {tab === "contratos" && <ContratosTab partnerId={partnerId} />}
      {tab === "parcelas" && <ParcelasTab partnerId={partnerId} initialStatus={sp.get("status") ?? ""} />}
      {tab === "lancamentos" && <LancamentosTab partnerId={partnerId} />}
      {tab === "exportar" && <ExportarTab partnerId={partnerId} />}
    </div>
  );
}
