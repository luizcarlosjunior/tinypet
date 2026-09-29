import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchFilters } from "@/components/public/search-filters";
import { PartnerCard } from "@/components/public/partner-card";
import { Empty } from "@/components/ui";
import { serverApiList } from "@/lib/server-api";
import type { PublicPartnerSummary } from "@/components/public/types";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const KEYS = ["q", "type", "category", "species", "minRating", "city", "state", "lat", "lng", "radiusKm", "page"];

export function generateMetadata({ searchParams }: { searchParams: Params }): Metadata {
  const city = typeof searchParams.city === "string" ? searchParams.city : "";
  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const title = [q || "Parceiros", city ? `em ${city}` : ""].filter(Boolean).join(" ");
  return { title: `Buscar ${title}`, description: `Encontre ${q || "adestradores, clínicas, lojas e pet shops"}${city ? ` em ${city}` : ""} no tinyPet.` };
}

export default async function BuscarPage({ searchParams }: { searchParams: Params }) {
  const sp = new URLSearchParams();
  for (const k of KEYS) {
    const v = searchParams[k];
    if (typeof v === "string" && v) sp.set(k, v);
  }
  if (!sp.get("pageSize")) sp.set("pageSize", "20");
  const res = await serverApiList<PublicPartnerSummary[]>(`/public/partners?${sp.toString()}`, { revalidate: 0, cache: "no-store" });
  const items = res?.data ?? [];
  const meta = res?.meta;
  const page = Number(sp.get("page") || 1);
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
  const pageHref = (p: number) => {
    const n = new URLSearchParams(sp.toString());
    n.delete("pageSize");
    n.set("page", String(p));
    return `/buscar?${n.toString()}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Buscar parceiros</h1>
      <Suspense fallback={<div className="card h-24 animate-pulse" />}>
        <SearchFilters />
      </Suspense>
      <p className="text-sm text-[var(--muted)]" aria-live="polite">
        {res == null ? "Não foi possível carregar os resultados agora." : meta ? `${meta.total} ${meta.total === 1 ? "parceiro encontrado" : "parceiros encontrados"}` : `${items.length} resultados`}
      </p>
      {items.length === 0 ? (
        <Empty title="Nenhum parceiro por aqui ainda" description="Tente ampliar a busca, remover filtros ou procurar em outra cidade." action={<Link href="/buscar" className="btn-secondary">Limpar filtros</Link>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((p) => (
            <PartnerCard key={p.id} p={p} />
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginação">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="btn-secondary">
              Anterior
            </Link>
          )}
          <span className="text-sm text-[var(--muted)]">
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="btn-secondary">
              Próxima
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
