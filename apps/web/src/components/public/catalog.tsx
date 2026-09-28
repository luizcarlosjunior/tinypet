import Link from "next/link";
import { CalendarPlus, Clock, Home, MapPin, Video } from "lucide-react";
import { formatBRL, safeHref } from "@tinypet/shared";
import { RatingStars } from "@/components/ui/rating";
import { fmtDate } from "@/lib/format";
import { isPromoActive, type PublicItem } from "./types";

export function PriceTag({ item, size = "md" }: { item: Pick<PublicItem, "price" | "promoPrice" | "promoUntil">; size?: "md" | "lg" }) {
  const promo = isPromoActive(item);
  const big = size === "lg" ? "text-2xl" : "text-base";
  if (item.price == null && !promo) return <span className={`${big} font-semibold`}>Sob consulta</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span className={`${big} font-semibold ${promo ? "text-emerald-700 dark:text-emerald-300" : ""}`}>{formatBRL(promo ? item.promoPrice : item.price)}</span>
      {promo && item.price != null && <s className="text-sm text-[var(--muted)]">{formatBRL(item.price)}</s>}
      {promo && item.promoUntil && <span className="text-xs text-[var(--muted)]">até {fmtDate(item.promoUntil)}</span>}
    </span>
  );
}

export function LocationIcons({ locations }: { locations: PublicItem["serviceLocations"] }) {
  if (!locations?.length) return null;
  const map = { PARTNER_VENUE: { icon: MapPin, label: "No estabelecimento" }, CLIENT_HOME: { icon: Home, label: "A domicílio" }, ONLINE: { icon: Video, label: "Online" } } as const;
  return (
    <ul className="flex flex-wrap gap-2 text-xs text-[var(--muted)]" aria-label="Onde atende">
      {locations.map((l) => {
        const m = map[l];
        if (!m) return null;
        const Icon = m.icon;
        return (
          <li key={l} className="inline-flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" aria-hidden /> {m.label}
          </li>
        );
      })}
    </ul>
  );
}

export function ItemCard({ item, slug }: { item: PublicItem; slug: string }) {
  const cover = item.media?.find((m) => m.isCover) ?? item.media?.[0];
  return (
    <article className="card flex gap-3 p-3">
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safeHref(cover.thumbUrl ?? cover.url)} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold">
          <Link href={`/p/${slug}/item/${item.id}`} className="hover:underline">
            {item.name}
          </Link>
        </h4>
        {item.description && <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted)]">{item.description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
          {item.durationMinutes && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {item.durationMinutes} min
            </span>
          )}
          <LocationIcons locations={item.serviceLocations} />
          {item.ratingCount > 0 && <RatingStars value={item.ratingAvg} count={item.ratingCount} size={12} />}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <PriceTag item={item} />
          {item.type === "SERVICE" && item.bookable && (
            <Link href={`/p/${slug}/agendar/${item.id}`} className="btn-primary h-8 px-3 text-xs">
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Agendar
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function CatalogByCategory({ items, slug }: { items: PublicItem[]; slug: string }) {
  const groups = new Map<string, { label: string; items: PublicItem[] }>();
  for (const it of items) {
    const key = it.category?.id ?? it.categoryId ?? "outros";
    const label = it.category?.label ?? "Outros";
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key)!.items.push(it);
  }
  if (!items.length) return <p className="text-sm text-[var(--muted)]">Este parceiro ainda não publicou itens no catálogo.</p>;
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([key, g]) => (
        <section key={key} aria-labelledby={`cat-${key}`}>
          <h3 id={`cat-${key}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {g.label}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {g.items.map((it) => (
              <ItemCard key={it.id} item={it} slug={slug} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
