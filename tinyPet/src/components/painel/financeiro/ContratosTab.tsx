"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatBRL } from "@tinypet/shared";
import { Select } from "@/components/ui";
import { QueryState, Table, td, th, Pagination } from "@/components/painel/ui";
import { useContracts } from "@/hooks/use-finance";
import { num, fmtDay } from "@/lib/format";
import { CONTRACT_STATUS_LABEL, CONTRACT_TYPE_LABEL, ContractStatusBadge } from "./common";

export function ContratosTab({ partnerId }: { partnerId: string | null }) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useContracts(partnerId, { status, page, pageSize: 20 });
  const items = q.data?.data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Select id="ct-status" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto">
          <option value="">Todos</option>
          {Object.entries(CONTRACT_STATUS_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <Link href="/painel/financeiro/contratos/novo" className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden /> Novo contrato
        </Link>
      </div>
      <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()}>
        <Table>
          <thead>
            <tr>
              <th className={th}>Contrato</th>
              <th className={th}>Cliente</th>
              <th className={th}>Tipo</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={th}>Parcelas</th>
              <th className={th}>1º venc.</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td className={`${td} text-center text-[var(--muted)]`} colSpan={7}>
                  Nenhum contrato encontrado.
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id}>
                <td className={td}>
                  <Link href={`/painel/financeiro/contratos/${c.id}`} className="font-medium hover:underline">
                    {c.title}
                  </Link>
                </td>
                <td className={td}>{c.client ? <Link href={`/painel/clientes/${c.client.id}`} className="hover:underline">{c.client.name}</Link> : "—"}</td>
                <td className={td}>{CONTRACT_TYPE_LABEL[c.type] ?? c.type}</td>
                <td className={`${td} text-right tabular-nums`}>{formatBRL(c.netAmount ?? num(c.totalAmount) - num(c.discount))}</td>
                <td className={td}>{c.installmentsCount}x</td>
                <td className={td}>{fmtDay(c.firstDueDate)}</td>
                <td className={td}>
                  <ContractStatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {q.data?.meta && <Pagination page={q.data.meta.page} pageSize={q.data.meta.pageSize} total={q.data.meta.total} onChange={setPage} />}
      </QueryState>
    </div>
  );
}
