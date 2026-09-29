"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { Avatar, Pagination, QueryState, SearchInput, Switch, Table, td, th } from "@/components/painel/ui";
import { useAdminMutations, useAdminPartners, useAdminPlans, type AdminPartner } from "@/hooks/use-admin";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function planKeyOf(p: AdminPartner) {
  return p.planKey ?? p.subscription?.plan?.key ?? p.plan ?? "";
}

export default function ParceirosPage() {
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
  const list = useAdminPartners(debounced, page);
  const plans = useAdminPlans();
  const m = useAdminMutations("partners");
  const partnerPlans = (plans.data?.items ?? []).filter((p) => p.audience === "PARTNER");
  const rows = list.data?.items ?? [];
  const meta = list.data?.meta;

  return (
    <div className="space-y-4">
      <PageHeader title="Parceiros" description="Atribua planos, destaque na busca e controle a publicação da página pública." />
      <SearchInput value={q} onChange={setQ} placeholder="Nome fantasia ou slug…" className="max-w-md" label="Buscar parceiros" />
      <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()}>
        <Table>
          <thead>
            <tr>
              <th className={th}>Parceiro</th>
              <th className={th}>Página</th>
              <th className={th}>Plano</th>
              <th className={th}>Destaque</th>
              <th className={th}>Publicado</th>
              <th className={th}>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className={cn(td, "py-6 text-center text-[var(--muted)]")}>
                  Nenhum parceiro encontrado.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={td}>
                  <span className="flex items-center gap-2 font-medium">
                    <Avatar src={p.logoUrl} name={p.tradeName} size={28} />
                    {p.tradeName}
                  </span>
                </td>
                <td className={td}>
                  <Link href={`/p/${p.slug}`} target="_blank" className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-300">
                    /p/{p.slug} <ExternalLink className="h-3 w-3" aria-hidden />
                  </Link>
                </td>
                <td className={td}>
                  <select aria-label={`Plano de ${p.tradeName}`} className="input w-auto py-1" value={planKeyOf(p)} onChange={(e) => e.target.value && m.update.mutate({ id: p.id, body: { planKey: e.target.value } })}>
                    <option value="">—</option>
                    {partnerPlans.map((pl) => (
                      <option key={pl.key} value={pl.key}>
                        {pl.name}
                      </option>
                    ))}
                    {planKeyOf(p) && !partnerPlans.some((pl) => pl.key === planKeyOf(p)) && <option value={planKeyOf(p)}>{planKeyOf(p)}</option>}
                  </select>
                </td>
                <td className={td}>
                  <Switch checked={!!p.featured} label={`Destaque: ${p.tradeName}`} disabled={m.update.isPending} onChange={(v) => m.update.mutate({ id: p.id, body: { featured: v } })} />
                </td>
                <td className={td}>
                  <Switch checked={!!p.published} label={`Publicado: ${p.tradeName}`} disabled={m.update.isPending} onChange={(v) => m.update.mutate({ id: p.id, body: { published: v } })} />
                </td>
                <td className={td}>{p.createdAt ? fmtDate(p.createdAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onChange={setPage} />}
      </QueryState>
    </div>
  );
}
