import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { RatingStars } from "@/components/ui/rating";
import { JsonLd } from "@/components/public/json-ld";
import { CatalogByCategory } from "@/components/public/catalog";
import { ReviewList } from "@/components/public/reviews";
import { AddressBlock, BusinessHours, SocialLinks, VenuePhotos } from "@/components/public/partner-sections";
import { serverApi, appUrl } from "@/lib/server-api";
import { num, typeLabel, type PublicPartner } from "@/components/public/types";
import { Empty } from "@/components/ui";
import Link from "next/link";

export const revalidate = 60;
/** No build-time params: each page renders on its first visit and is then served from the ISR cache. */
export async function generateStaticParams() {
  return [];
}

async function getPartner(slug: string) {
  return serverApi<PublicPartner>(`/public/partners/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPartner(params.slug);
  if (!p) return { title: "Parceiro não encontrado" };
  const desc = p.description?.slice(0, 160) || `${p.tradeName} no tinyPet: ${(p.types ?? []).map(typeLabel).join(", ")}${p.city ? ` em ${p.city}` : ""}.`;
  return {
    title: p.tradeName,
    description: desc,
    alternates: { canonical: appUrl(`/p/${p.slug}`) },
    openGraph: { title: p.tradeName, description: desc, type: "website", url: appUrl(`/p/${p.slug}`), images: p.logoUrl ? [{ url: p.logoUrl }] : undefined },
  };
}

export default async function PartnerPage({ params }: { params: { slug: string } }) {
  const p = await getPartner(params.slug);
  if (!p) notFound();
  const items = (p.catalogItems ?? p.items ?? []).filter((i) => !i.status || i.status === "PUBLISHED");
  const address = p.addresses?.find((a) => a.isPrimary) ?? p.addresses?.[0] ?? null;
  const rating = num(p.ratingAvg);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": appUrl(`/p/${p.slug}`),
    name: p.tradeName,
    description: p.description ?? undefined,
    image: p.logoUrl ?? undefined,
    url: appUrl(`/p/${p.slug}`),
    sameAs: p.socialLinks?.map((s) => s.url),
    address: address
      ? { "@type": "PostalAddress", streetAddress: [address.street, address.number].filter(Boolean).join(", "), addressLocality: address.city, addressRegion: address.state, postalCode: address.zipCode, addressCountry: "BR" }
      : undefined,
    geo: num(address?.latitude) != null ? { "@type": "GeoCoordinates", latitude: num(address?.latitude), longitude: num(address?.longitude) } : undefined,
    openingHoursSpecification: p.businessHours
      ?.filter((h) => !h.closed)
      .map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][h.weekday], opens: h.opensAt, closes: h.closesAt })),
    aggregateRating: rating && p.ratingCount > 0 ? { "@type": "AggregateRating", ratingValue: rating, reviewCount: p.ratingCount, bestRating: 5, worstRating: 1 } : undefined,
  };

  return (
    <article className="space-y-8">
      <JsonLd data={jsonLd} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar src={p.logoUrl} name={p.tradeName} size={96} square />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{p.tradeName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{(p.types ?? []).map(typeLabel).join(" · ")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <RatingStars value={p.ratingAvg} count={p.ratingCount} />
            {(p.city || address?.city) && <span className="text-[var(--muted)]">{[p.city ?? address?.city, p.state ?? address?.state].filter(Boolean).join(" - ")}</span>}
          </div>
          {p.description && <p className="mt-3 max-w-3xl whitespace-pre-line text-sm">{p.description}</p>}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <AddressBlock address={address} tradeName={p.tradeName} radiusKm={p.serviceRadiusKm} />
        <BusinessHours hours={p.businessHours} />
        <SocialLinks links={p.socialLinks} website={p.website} />
      </div>

      <VenuePhotos photos={p.venuePhotos} />

      <section aria-labelledby="catalogo">
        <h2 id="catalogo" className="mb-3 text-xl font-bold">
          Produtos e serviços
        </h2>
        <CatalogByCategory items={items} slug={p.slug} />
      </section>

      <section aria-labelledby="avaliacoes">
        <h2 id="avaliacoes" className="mb-3 text-xl font-bold">
          Avaliações {p.ratingCount ? `(${p.ratingCount})` : ""}
        </h2>
        {p.reviews?.length ? (
          <ReviewList reviews={p.reviews} showItem />
        ) : (
          <Empty title="Sem avaliações ainda" description="Avalie um item do catálogo depois de usar o serviço ou produto." action={items[0] ? <Link href={`/p/${p.slug}/item/${items[0].id}`} className="btn-secondary">Ver itens</Link> : undefined} />
        )}
      </section>
    </article>
  );
}
