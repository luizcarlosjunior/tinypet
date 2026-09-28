"use client";
import { useEffect, useState } from "react";
import { Badge, PageHeader } from "@/components/ui";
import { Pagination, QueryState, SearchInput, Table, td, th } from "@/components/painel/ui";
import { useAdminMutations, useAdminPlans, useAdminUsers, type AdminUser } from "@/hooks/use-admin";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function planKeyOf(u: AdminUser) {
  return u.planKey ?? u.plan ?? u.subscription?.plan?.key ?? "";
}

export default function UsuariosPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const list = useAdminUsers(debounced, page);
  const plans = useAdminPlans();
  const m = useAdminMutations("users");
  const ownerPlans = (plans.data?.items ?? []).filter((p) => p.audience === "OWNER");
  const rows = list.data?.items ?? [];
  const meta = list.data?.meta;

  return (
    <div className="space-y-4">
      <PageHeader title="Usuários" description="Busque por nome ou e-mail. Altere o papel e atribua planos manualmente (cobrança entra na fase 3)." />
      <SearchInput value={q} onChange={setQ} placeholder="Nome ou e-mail…" className="max-w-md" label="Buscar usuários" />
      <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()}>
        <Table>
          <thead>
            <tr>
              <th className={th}>Nome</th>
              <th className={th}>E-mail</th>
              <th className={th}>Papel</th>
              <th className={th}>Plano</th>
              <th className={th}>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={cn(td, "py-6 text-center text-[var(--muted)]")}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id}>
                <td className={cn(td, "font-medium")}>{u.name}</td>
                <td className={td}>{u.email}</td>
                <td className={td}>
                  <select aria-label={`Papel de ${u.name}`} className="input w-auto py-1" value={u.role} onChange={(e) => m.update.mutate({ id: u.id, body: { role: e.target.value } })}>
                    <option value="USER">Usuário</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  {u.role === "ADMIN" && (
                    <Badge tone="brand" className="ml-2">
                      Admin
                    </Badge>
                  )}
                </td>
                <td className={td}>
                  <select aria-label={`Plano de ${u.name}`} className="input w-auto py-1" value={planKeyOf(u)} onChange={(e) => e.target.value && m.update.mutate({ id: u.id, body: { planKey: e.target.value } })}>
                    <option value="">—</option>
                    {ownerPlans.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.name}
                      </option>
                    ))}
                    {planKeyOf(u) && !ownerPlans.some((p) => p.key === planKeyOf(u)) && <option value={planKeyOf(u)}>{planKeyOf(u)}</option>}
                  </select>
                </td>
                <td className={td}>{u.createdAt ? fmtDate(u.createdAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onChange={setPage} />}
      </QueryState>
    </div>
  );
}
