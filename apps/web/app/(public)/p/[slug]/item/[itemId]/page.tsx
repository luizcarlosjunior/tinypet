import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, ChevronLeft, Clock } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { RatingStars } from "@/components/ui/rating";
import { JsonLd } from "@/components/public/json-ld";
import { LocationIcons, PriceTag } from "@/components/public/catalog";
import { ReviewList, ReviewForm } from "@/components/public/reviews";
import { ItemMedia } from "@/components/public/item-media";
import { serverApi, appUrl } from "@/lib/server-api";
import { isPromoActive, num, type PublicItem } from "@/components/public/types";
import { SPECIES } from "@tinypet/shared";

export const revalidate = 60;

async function getItem(id: string) {
  return serverApi<PublicItem>(`/public/items/${encodeURIComponent(id)}`);
}

export async function generateMetadata({ params }: { params: { slug: string; itemId: string } }): Promise<Metadata> {
  const it = await getItem(params.itemId);
  if (!it) return { title: "Item não encontrado" };
  const desc = it.description?.slice(0, 160) || `${it.name} por ${it.partner?.tradeName ?? "parceiro tinyPet"}.`;
  const cover = it.media?.find((m) => m.isCover) ?? it.media?.[0];
  return {
    title: `${it.name} · ${it.partner?.tradeName ?? "tinyPet"}`,
    description: desc,
    alternates: { canonical: appUrl(`/p/${params.slug}/item/${it.id}`) },
    openGraph: { title: it.name, description: desc, images: cover ? [{ url: cover.url }] : undefined },
  };
}

export default async function ItemPage({ params }: { params: { slug: string; itemId: string } }) {
  const it = await getItem(params.itemId);
  if (!it) notFound();
  const slug = it.partner?.slug ?? params.slug;
  const promo = isPromoActive(it);
  const price = promo ? num(it.promoPrice) : num(it.price);
  const rating = num(it.ratingAvg);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": it.type === "PRODUCT" ? "Product" : "Service",
    name: it.name,
    description: it.description ?? undefined,
    image: it.media?.map((m) => m.url),
    brand: it.brand ? { "@type": "Brand", name: it.brand.name } : undefined,
    ...(it.type === "SERVICE" ? { provider: { "@type": "LocalBusiness", name: it.partner?.tradeName, url: appUrl(`/p/${slug}`) } } : { seller: { "@type": "LocalBusiness", name: it.partner?.tradeName } }),
    offers: price != null ? { "@type": "Offer", price, priceCurrency: "BRL", availability: "https://schema.org/InStock", url: appUrl(`/p/${slug}/item/${it.id}`), ...(promo && it.promoUntil ? { priceValidUntil: it.promoUntil.slice(0, 10) } : {}) } : undefined,
    aggregateRating: rating && it.ratingCount > 0 ? { "@type": "AggregateRating", ratingValue: rating, reviewCount: it.ratingCount, bestRating: 5, worstRating: 1 } : undefined,
  };
  const species = (it.speciesKeys ?? []).map((k) => SPECIES.find((s) => s.key === k)?.label ?? k);

  return (
    <article className="space-y-8">
      <JsonLd data={jsonLd} />
      <nav aria-label="Voltar">
        <Link href={`/p/${slug}`} className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
          <ChevronLeft className="h-4 w-4" aria-hidden /> {it.partner?.tradeName ?? "Voltar ao parceiro"}
        </Link>
      </nav>
      <div className="grid gap-6 md:grid-cols-2">
        <ItemMedia media={it.media ?? []} name={it.name} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {it.type === "PRODUCT" ? "Produto" : "Serviço"}
            {it.category ? ` · ${it.category.label}` : ""}
            {it.subcategory ? ` · ${it.subcategory.label}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{it.name}</h1>
          <div className="mt-2">
            <RatingStars value={it.ratingAvg} count={it.ratingCount} />
          </div>
          <div className="mt-4">
            <PriceTag item={it} size="lg" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
            {it.durationMinutes && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" aria-hidden /> {it.durationMinutes} min
              </span>
            )}
            <LocationIcons locations={it.serviceLocations} />
          </div>
          {it.brand && (
            <p className="mt-2 text-sm">
              Marca: <strong>{it.brand.name}</strong>
              {it.productLine ? ` · ${it.productLine.name}` : ""}
            </p>
          )}
          {species.length > 0 && <p className="mt-1 text-sm text-[var(--muted)]">Para: {species.join(", ")}</p>}
          {it.description && <p className="mt-4 whitespace-pre-line text-sm">{it.description}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            {it.type === "SERVICE" && it.bookable && (
              <Link href={`/p/${slug}/agendar/${it.id}`} className="btn-primary">
                <CalendarPlus className="h-4 w-4" aria-hidden /> Agendar
              </Link>
            )}
            <Link href={`/p/${slug}`} className="btn-secondary">
              Ver parceiro
            </Link>
          </div>
          {it.partner && (
            <Link href={`/p/${slug}`} className="mt-6 flex items-center gap-3 rounded-2xl border p-3 hover:bg-ink-50 dark:hover:bg-ink-800/50">
              <Avatar src={it.partner.logoUrl} name={it.partner.tradeName} size={40} square />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{it.partner.tradeName}</span>
                <span className="block text-xs text-[var(--muted)]">{[it.partner.city, it.partner.state].filter(Boolean).join(" - ")}</span>
              </span>
            </Link>
          )}
        </div>
      </div>

      <section aria-labelledby="avaliacoes" className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div>
          <h2 id="avaliacoes" className="mb-3 text-xl font-bold">
            Avaliações {it.ratingCount ? `(${it.ratingCount})` : ""}
          </h2>
          <ReviewList reviews={it.reviews ?? []} />
        </div>
        <div>
          <ReviewForm itemId={it.id} />
        </div>
      </section>
    </article>
  );
}
