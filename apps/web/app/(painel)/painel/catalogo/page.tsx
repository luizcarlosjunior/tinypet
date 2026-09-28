"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarCheck, Clock, ImageOff, Plus, Trash2 } from "lucide-react";
import { formatBRL } from "@tinypet/shared";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { ConfirmDialog, QueryState, SearchInput, UsageBar } from "@/components/painel/ui";
import { useActivePartner, usePartnerPlan } from "@/hooks/use-partner";
import { useCatalog, useDeleteCatalogItem, useUpdateCatalogStatus } from "@/hooks/use-catalog";
import { ITEM_STATUS_LABEL, ITEM_STATUS_TONE, SERVICE_LOCATION_LABEL, coverOf } from "@/components/painel/catalogo/helpers";
import { fmtMinutes } from "@/lib/format";
import type { CatalogItem } from "@/types/api";

export default function CatalogoPage() {
  const { partnerId } = useActivePartner();
  const plan = usePartnerPlan(partnerId);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const list = useCatalog(partnerId, { type: type || undefined, status: status || undefined, q: q.trim() || undefined });
  const del = useDeleteCatalogItem();
  const setStatusM = useUpdateCatalogStatus();
  const [toDelete, setToDelete] = useState<CatalogItem | null>(null);

  const groups = useMemo(() => {
    const items = list.data ?? [];
    return [
      { key: "SERVICE", label: "Serviços", items: items.filter((i) => i.type === "SERVICE") },
      { key: "PRODUCT", label: "Produtos", items: items.filter((i) => i.type === "PRODUCT") },
    ].filter((g) => g.items.length > 0);
  }, [list.data]);

  const limit = plan.data?.limits?.catalog_items;
  const used = plan.data?.usage?.catalog_items ?? list.data?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Catálogo"
        description="Produtos e serviços publicados na sua página."
        actions={
          <Link href="/painel/catalogo/novo" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden /> Novo item
          </Link>
        }
      />
      {plan.data && (
        <div className="card mb-4">
          <UsageBar label="Itens no catálogo" used={used} limit={limit?.quantity ?? null} enabled={limit?.enabled ?? true} />
        </div>
      )}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar item…" />
        <select aria-label="Tipo" className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="SERVICE">Serviços</option>
          <option value="PRODUCT">Produtos</option>
        </select>
        <select aria-label="Status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="DRAFT">Rascunho</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="PAUSED">Pausado</option>
        </select>
      </div>

      <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()} isEmpty={(list.data ?? []).length === 0} empty={<Empty title="Nenhum item no catálogo" description="Cadastre seu primeiro serviço ou produto para aparecer na busca." action={<Link href="/painel/catalogo/novo" className="btn-primary">Novo item</Link>} />}>
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`grp-${g.key}`}>
              <h2 id={`grp-${g.key}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                {g.label} <span className="font-normal">({g.items.length})</span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((item) => (
                  <li key={item.id} className="card flex gap-3 p-3">
                    <Link href={`/painel/catalogo/${item.id}`} className="block h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-900" aria-label={`Editar ${item.name}`}>
                      {coverOf(item) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverOf(item)!} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[var(--muted)]">
                          <ImageOff className="h-6 w-6" aria-hidden />
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/painel/catalogo/${item.id}`} className="truncate font-medium hover:underline">
                          {item.name}
                        </Link>
                        <Badge tone={ITEM_STATUS_TONE[item.status]}>{ITEM_STATUS_LABEL[item.status]}</Badge>
                      </div>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {[item.category?.label, item.subcategory?.label].filter(Boolean).join(" › ") || "Sem categoria"}
                      </p>
                      <p className="mt-1 text-sm">
                        {item.promoPrice != null && item.price != null ? (
                          <>
                            <span className="text-[var(--muted)] line-through">{formatBRL(item.price)}</span> <span className="font-semibold text-brand-600 dark:text-brand-300">{formatBRL(item.promoPrice)}</span>
                          </>
                        ) : (
                          <span className="font-semibold">{formatBRL(item.price)}</span>
                        )}
                      </p>
                      {item.type === "SERVICE" && (
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--muted)]">
                          {item.durationMinutes != null && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" aria-hidden /> {fmtMinutes(item.durationMinutes)}
                            </span>
                          )}
                          {(item.serviceLocations ?? []).map((l) => (
                            <span key={l}>{SERVICE_LOCATION_LABEL[l]}</span>
                          ))}
                          {item.bookable && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300" title="Agendável pelo app">
                              <CalendarCheck className="h-3 w-3" aria-hidden /> Agendável
                            </span>
                          )}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <select aria-label={`Status de ${item.name}`} className="input h-8 py-0 text-xs" value={item.status} onChange={(e) => setStatusM.mutate({ id: item.id, status: e.target.value as CatalogItem["status"] })}>
                          <option value="DRAFT">Rascunho</option>
                          <option value="PUBLISHED">Publicado</option>
                          <option value="PAUSED">Pausado</option>
                        </select>
                        <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label={`Excluir ${item.name}`} onClick={() => setToDelete(item)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </QueryState>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })} title={`Excluir "${toDelete?.name}"?`} description="O item deixa de aparecer na página pública. Agendamentos e contratos existentes são mantidos." confirmLabel="Excluir" danger loading={del.isPending} />
    </div>
  );
}
