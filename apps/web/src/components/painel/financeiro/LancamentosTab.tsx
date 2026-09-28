"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { formatBRL, PAYMENT_METHOD_LABEL, transactionSchema } from "@tinypet/shared";
import { Badge, Button, Input, Modal, Select } from "@/components/ui";
import { ConfirmDialog, QueryState, Table, td, th, Pagination } from "@/components/painel/ui";
import { useCreateTransaction, useDeleteTransaction, useTransactions } from "@/hooks/use-finance";
import { fmtDate, num, todayISO } from "@/lib/format";

type TransactionInput = z.infer<typeof transactionSchema>;
const CATEGORIES = ["Serviços", "Produtos", "Cursos", "Aluguel", "Salários", "Materiais", "Combustível", "Marketing", "Impostos", "Outros"];

export function LancamentosTab({ partnerId }: { partnerId: string | null }) {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<string | null>(null);
  const q = useTransactions(partnerId, { kind, from, to, page, pageSize: 30 });
  const items = q.data?.data ?? [];
  const income = items.filter((t) => t.kind === "INCOME").reduce((a, t) => a + num(t.amount), 0);
  const expense = items.filter((t) => t.kind === "EXPENSE").reduce((a, t) => a + num(t.amount), 0);
  const remove = useDeleteTransaction();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <Select id="tx-kind" label="Tipo" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className="w-auto">
            <option value="">Todos</option>
            <option value="INCOME">Receitas</option>
            <option value="EXPENSE">Despesas</option>
          </Select>
          <Input id="tx-from" label="De" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input id="tx-to" label="Até" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Novo lançamento
        </Button>
      </div>
      <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()}>
        <Table>
          <thead>
            <tr>
              <th className={th}>Data</th>
              <th className={th}>Tipo</th>
              <th className={th}>Categoria</th>
              <th className={th}>Descrição</th>
              <th className={th}>Forma</th>
              <th className={`${th} text-right`}>Valor</th>
              <th className={th}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td className={`${td} text-center text-[var(--muted)]`} colSpan={7}>
                  Nenhum lançamento.
                </td>
              </tr>
            )}
            {items.map((t) => (
              <tr key={t.id}>
                <td className={td}>{fmtDate(t.occurredAt)}</td>
                <td className={td}>{t.kind === "INCOME" ? <Badge tone="green">Receita</Badge> : <Badge tone="red">Despesa</Badge>}</td>
                <td className={td}>{t.category}</td>
                <td className={td}>{t.description ?? "—"}</td>
                <td className={td}>{t.method ? PAYMENT_METHOD_LABEL[t.method as keyof typeof PAYMENT_METHOD_LABEL] ?? t.method : "—"}</td>
                <td className={`${td} text-right tabular-nums ${t.kind === "EXPENSE" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                  {t.kind === "EXPENSE" ? "− " : ""}
                  {formatBRL(t.amount)}
                </td>
                <td className={`${td} text-right`}>
                  <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label="Remover lançamento" onClick={() => setDel(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="font-medium">
                <td className={td} colSpan={5}>
                  Totais desta página
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  <span className="block text-emerald-700 dark:text-emerald-300">+ {formatBRL(income)}</span>
                  <span className="block text-red-700 dark:text-red-300">− {formatBRL(expense)}</span>
                  <span className="block">= {formatBRL(income - expense)}</span>
                </td>
                <td className={td} />
              </tr>
            </tfoot>
          )}
        </Table>
        {q.data?.meta && <Pagination page={q.data.meta.page} pageSize={q.data.meta.pageSize} total={q.data.meta.total} onChange={setPage} />}
      </QueryState>
      <TransactionModal open={open} onClose={() => setOpen(false)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del, { onSuccess: () => setDel(null) })} title="Remover lançamento?" description="Esta ação não pode ser desfeita." confirmLabel="Remover" danger loading={remove.isPending} />
    </div>
  );
}

function TransactionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const form = useForm<TransactionInput>({ resolver: zodResolver(transactionSchema), defaultValues: { kind: "EXPENSE", category: "", description: "", amount: undefined, occurredAt: todayISO(), method: null } });
  const { register, handleSubmit, reset, formState: { errors } } = form;
  const create = useCreateTransaction(() => {
    reset({ kind: "EXPENSE", category: "", description: "", amount: undefined, occurredAt: todayISO(), method: null });
    onClose();
  });
  return (
    <Modal open={open} onClose={onClose} title="Novo lançamento">
      <form className="space-y-3" onSubmit={handleSubmit((v) => create.mutate({ ...v, description: v.description || null, method: v.method || null }))} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Select id="tx-f-kind" label="Tipo" {...register("kind")} error={errors.kind?.message}>
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
          </Select>
          <Input id="tx-f-date" label="Data" type="date" {...register("occurredAt")} error={errors.occurredAt?.message} />
        </div>
        <div>
          <Input id="tx-f-category" label="Categoria" list="tx-categories" placeholder="Ex.: Materiais" {...register("category")} error={errors.category?.message} />
          <datalist id="tx-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <Input id="tx-f-desc" label="Descrição" {...register("description")} />
        <div className="grid grid-cols-2 gap-3">
          <Input id="tx-f-amount" label="Valor (R$)" type="number" step="0.01" min="0.01" inputMode="decimal" {...register("amount")} error={errors.amount?.message} />
          <Select id="tx-f-method" label="Forma" {...register("method")}>
            <option value="">—</option>
            {Object.entries(PAYMENT_METHOD_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
