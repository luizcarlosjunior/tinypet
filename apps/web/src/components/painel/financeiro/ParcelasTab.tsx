"use client";
import { useState } from "react";
import { INSTALLMENT_STATUS_LABEL } from "@tinypet/shared";
import { Input, Select } from "@/components/ui";
import { QueryState, Pagination } from "@/components/painel/ui";
import { useInstallments } from "@/hooks/use-finance";
import { InstallmentsTable } from "./InstallmentsTable";

export function ParcelasTab({ partnerId, initialStatus = "" }: { partnerId: string | null; initialStatus?: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const q = useInstallments(partnerId, { status, from, to, page, pageSize: 30 });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Select id="in-status" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto">
          <option value="">Todos</option>
          {Object.entries(INSTALLMENT_STATUS_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <Input id="in-from" label="Vencimento de" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input id="in-to" label="até" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>
      <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()}>
        <InstallmentsTable items={q.data?.data ?? []} partnerId={partnerId} />
        {q.data?.meta && <Pagination page={q.data.meta.page} pageSize={q.data.meta.pageSize} total={q.data.meta.total} onChange={setPage} />}
      </QueryState>
    </div>
  );
}
