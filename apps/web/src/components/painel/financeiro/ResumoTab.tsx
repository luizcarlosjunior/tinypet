"use client";
import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import { formatBRL, PAYMENT_METHOD_LABEL } from "@tinypet/shared";
import { Card, Input, Select } from "@/components/ui";
import { QueryState, StatCard, Table, td, th } from "@/components/painel/ui";
import { useFinanceSummary } from "@/hooks/use-finance";
import { fmtDateKey, num, todayISO } from "@/lib/format";
import { InstallmentsTable } from "./InstallmentsTable";
import { ReceivedChart } from "./ReceivedChart";

type Preset = "month" | "3m" | "12m" | "custom";

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const to = format(endOfMonth(now), "yyyy-MM-dd");
  if (p === "month") return { from: format(startOfMonth(now), "yyyy-MM-dd"), to };
  if (p === "3m") return { from: format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"), to };
  return { from: format(startOfMonth(subMonths(now, 11)), "yyyy-MM-dd"), to };
}

export function ResumoTab({ partnerId }: { partnerId: string | null }) {
  const [preset, setPreset] = useState<Preset>("12m");
  const [custom, setCustom] = useState({ from: presetRange("3m").from, to: presetRange("3m").to });
  const range = preset === "custom" ? custom : presetRange(preset);
  const q = useFinanceSummary(partnerId, range);
  const s = q.data;
  const thisMonth = todayISO().slice(0, 7);
  const overdue = s?.overdue ?? [];
  const overdueTotal = overdue.reduce((a, i) => a + Math.max(0, num(i.amount) - num(i.paidAmount)), 0);
  const receivedThisMonth = useMemo(() => {
    if (!s) return 0;
    if (s.receivedThisMonth != null) return num(s.receivedThisMonth);
    return num((s.receivedByMonth ?? []).find((m) => m.month?.startsWith(thisMonth))?.amount);
  }, [s, thisMonth]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Select id="fin-preset" label="Período" value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className="w-auto">
          <option value="month">Este mês</option>
          <option value="3m">Últimos 3 meses</option>
          <option value="12m">Últimos 12 meses</option>
          <option value="custom">Personalizado</option>
        </Select>
        {preset === "custom" && (
          <>
            <Input id="fin-from" label="De" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <Input id="fin-to" label="Até" type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </>
        )}
      </div>

      <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()}>
        {s && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="A receber" value={formatBRL(s.receivable)} hint="Parcelas a vencer no período" tone="brand" icon={<Wallet className="h-4 w-4" aria-hidden />} />
              <StatCard label="Vencidas" value={formatBRL(overdueTotal)} hint={`${overdue.length} ${overdue.length === 1 ? "parcela vencida" : "parcelas vencidas"}`} tone={overdue.length ? "red" : undefined} icon={<AlertTriangle className="h-4 w-4" aria-hidden />} />
              <StatCard label="Recebido no mês" value={formatBRL(receivedThisMonth)} hint={fmtDateKey(`${thisMonth}-01`, "MMMM 'de' yyyy")} tone="green" icon={<TrendingUp className="h-4 w-4" aria-hidden />} />
            </div>

            <Card title="Recebido por mês">
              <ReceivedChart data={s.receivedByMonth ?? []} />
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Recebido por forma de pagamento">
                <SimpleList rows={(s.receivedByMethod ?? []).map((r) => ({ label: PAYMENT_METHOD_LABEL[r.method as keyof typeof PAYMENT_METHOD_LABEL] ?? r.method, value: num(r.amount) }))} />
              </Card>
              <Card title="Recebido por serviço">
                <SimpleList rows={(s.receivedByService ?? []).map((r) => ({ label: r.service || "Sem serviço", value: num(r.amount) }))} />
              </Card>
            </div>

            <Card title="Fluxo de caixa">
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Mês</th>
                    <th className={`${th} text-right`}>Receitas</th>
                    <th className={`${th} text-right`}>Despesas</th>
                    <th className={`${th} text-right`}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {(s.cashflow ?? []).length === 0 && (
                    <tr>
                      <td className={`${td} text-center text-[var(--muted)]`} colSpan={4}>
                        Sem movimentações no período.
                      </td>
                    </tr>
                  )}
                  {(s.cashflow ?? []).map((c) => {
                    const bal = c.balance != null ? num(c.balance) : num(c.income) - num(c.expense);
                    return (
                      <tr key={c.month}>
                        <td className={td}>{/^\d{4}-\d{2}$/.test(c.month) ? fmtDateKey(`${c.month}-01`, "MMM/yyyy") : c.month}</td>
                        <td className={`${td} text-right tabular-nums text-emerald-700 dark:text-emerald-300`}>{formatBRL(c.income)}</td>
                        <td className={`${td} text-right tabular-nums text-red-700 dark:text-red-300`}>{formatBRL(c.expense)}</td>
                        <td className={`${td} text-right font-medium tabular-nums ${bal < 0 ? "text-red-700 dark:text-red-300" : ""}`}>{formatBRL(bal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>

            <Card title="Parcelas vencidas">
              <InstallmentsTable items={overdue} partnerId={partnerId} emptyText="Nenhuma parcela vencida. Ótimo!" />
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}

function SimpleList({ rows }: { rows: { label: string; value: number }[] }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!rows.length) return <p className="text-sm text-[var(--muted)]">Sem dados no período.</p>;
  return (
    <ul className="space-y-2">
      {rows
        .slice()
        .sort((a, b) => b.value - a.value)
        .map((r) => (
          <li key={r.label} className="text-sm">
            <div className="flex justify-between">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums">{formatBRL(r.value)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" aria-hidden>
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${total ? Math.round((r.value / total) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
    </ul>
  );
}
