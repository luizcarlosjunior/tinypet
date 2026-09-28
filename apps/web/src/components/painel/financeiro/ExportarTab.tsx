"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { Input } from "@/components/ui";
import { qs } from "@/hooks/use-finance";
import { todayISO } from "@/lib/format";

export function ExportarTab({ partnerId }: { partnerId: string | null }) {
  const [from, setFrom] = useState(format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"));
  const [to, setTo] = useState(todayISO());
  const link = (type: "installments" | "transactions") => `/api/v1/finance/export${qs({ type, from, to, partnerId })}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Input id="ex-from" label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input id="ex-to" label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card">
          <h3 className="font-semibold">Parcelas</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">Todas as parcelas com vencimento no período: contrato, cliente, valor, pago e status.</p>
          <a href={link("installments")} target="_blank" rel="noreferrer" className="btn-secondary mt-4">
            <Download className="h-4 w-4" aria-hidden /> Baixar CSV de parcelas
          </a>
        </section>
        <section className="card">
          <h3 className="font-semibold">Lançamentos</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">Receitas e despesas avulsas do período, com categoria e forma de pagamento.</p>
          <a href={link("transactions")} target="_blank" rel="noreferrer" className="btn-secondary mt-4">
            <Download className="h-4 w-4" aria-hidden /> Baixar CSV de lançamentos
          </a>
        </section>
      </div>
      <p className="text-xs text-[var(--muted)]">Os arquivos abrem no Excel, Google Planilhas ou Numbers. Emissão de nota fiscal não faz parte desta versão.</p>
    </div>
  );
}
