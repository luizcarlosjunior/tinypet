import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { RatingStars } from "@/components/ui/rating";
import { fmtKm } from "@/lib/format";
import { typeLabel, typeKey, type PublicPartnerSummary } from "./types";

export function PartnerCard({ p }: { p: PublicPartnerSummary }) {
  const mapsHref = p.lat != null && p.lng != null ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.tradeName} ${p.city ?? ""} ${p.state ?? ""}`)}`;
  return (
    <article className="card flex gap-4 transition hover:shadow-md">
      <Link href={`/p/${p.slug}`} className="shrink-0" aria-hidden tabIndex={-1}>
        <Avatar src={p.logoUrl} name={p.tradeName} size={64} square />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-semibold">
            <Link href={`/p/${p.slug}`} className="hover:underline">
              {p.tradeName}
            </Link>
          </h3>
          {p.featured && (
            <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              <Star className="mr-1 h-3 w-3" aria-hidden /> Destaque
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{(p.types ?? []).map(typeLabel).join(" · ")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
          <RatingStars value={p.ratingAvg} count={p.ratingCount} size={13} />
          {(p.city || p.state) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {[p.city, p.state].filter(Boolean).join(" - ")}
              {p.distanceKm != null && <span className="font-medium text-[var(--fg)]"> · {fmtKm(p.distanceKm)}</span>}
            </span>
          )}
        </div>
        {p.categories?.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1" aria-label="Categorias">
            {p.categories.slice(0, 4).map((c) => (
              <li key={typeKey(c)} className="badge bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                {typeLabel(c)}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex gap-2">
          <Link href={`/p/${p.slug}`} className="btn-primary h-8 px-3 text-xs">
            Ver página
          </Link>
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-3 text-xs">
            Ver no mapa
          </a>
        </div>
      </div>
    </article>
  );
}
