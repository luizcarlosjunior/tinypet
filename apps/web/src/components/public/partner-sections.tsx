import { Clock, ExternalLink, Globe, MapPin, Navigation } from "lucide-react";
import { mapsLinks } from "@tinypet/shared";
import { WEEKDAYS } from "@/lib/format";
import { addressLine } from "@/lib/format";
import { SOCIAL_LABEL, num, type PublicAddress, type PublicPartner } from "./types";

export function BusinessHours({ hours }: { hours: PublicPartner["businessHours"] }) {
  if (!hours?.length) return null;
  const today = new Date().getDay();
  const byDay = new Map(hours.map((h) => [h.weekday, h]));
  return (
    <section aria-labelledby="horarios" className="card">
      <h2 id="horarios" className="mb-2 inline-flex items-center gap-2 text-base font-semibold">
        <Clock className="h-4 w-4" aria-hidden /> Horário de funcionamento
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const h = byDay.get(d);
          return (
            <div key={d} className={`contents ${d === today ? "font-semibold" : ""}`}>
              <dt>{WEEKDAYS[d]}</dt>
              <dd className={h && !h.closed ? "" : "text-[var(--muted)]"}>{h && !h.closed ? `${h.opensAt} – ${h.closesAt}` : "Fechado"}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export function AddressBlock({ address, tradeName, radiusKm }: { address: PublicAddress | null | undefined; tradeName: string; radiusKm?: number | null }) {
  if (!address && !radiusKm) return null;
  const lat = num(address?.latitude);
  const lng = num(address?.longitude);
  const text = address ? `${addressLine(address)}` : tradeName;
  const links = mapsLinks(lat, lng, text);
  return (
    <section aria-labelledby="endereco" className="card">
      <h2 id="endereco" className="mb-2 inline-flex items-center gap-2 text-base font-semibold">
        <MapPin className="h-4 w-4" aria-hidden /> Endereço
      </h2>
      {address ? (
        <address className="text-sm not-italic">
          {address.street}
          {address.number ? `, ${address.number}` : ""}
          {address.complement ? ` – ${address.complement}` : ""}
          <br />
          {[address.district, `${address.city} - ${address.state}`].filter(Boolean).join(" · ")}
          {address.zipCode ? <span className="text-[var(--muted)]"> · CEP {address.zipCode}</span> : null}
        </address>
      ) : (
        <p className="text-sm text-[var(--muted)]">Atende a domicílio.</p>
      )}
      {radiusKm ? <p className="mt-1 text-xs text-[var(--muted)]">Atende em um raio de {radiusKm} km.</p> : null}
      {(address || lat != null) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={links.google} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-3 text-xs">
            <Navigation className="h-3.5 w-3.5" aria-hidden /> Google Maps
          </a>
          <a href={links.waze} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-3 text-xs">
            Waze
          </a>
          <a href={links.apple} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-3 text-xs">
            Apple Maps
          </a>
        </div>
      )}
    </section>
  );
}

export function SocialLinks({ links, website }: { links: PublicPartner["socialLinks"]; website?: string | null }) {
  if (!links?.length && !website) return null;
  return (
    <section aria-labelledby="redes" className="card">
      <h2 id="redes" className="mb-2 inline-flex items-center gap-2 text-base font-semibold">
        <Globe className="h-4 w-4" aria-hidden /> Site e redes
      </h2>
      <ul className="flex flex-wrap gap-2">
        {website && (
          <li>
            <a href={website} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-3 text-xs">
              Site <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </li>
        )}
        {links?.map((l) => (
          <li key={l.network}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 px-3 text-xs">
              {SOCIAL_LABEL[l.network] ?? l.network} <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VenuePhotos({ photos }: { photos: PublicPartner["venuePhotos"] }) {
  if (!photos?.length) return null;
  const sorted = [...photos].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <section aria-labelledby="fotos">
      <h2 id="fotos" className="mb-3 text-xl font-bold">
        Fotos do espaço
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {sorted.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-xl">
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbUrl ?? p.url} alt={p.caption ?? "Foto do estabelecimento"} loading="lazy" className="aspect-square w-full object-cover transition hover:scale-[1.02]" />
            </a>
            {p.caption && <p className="mt-1 text-xs text-[var(--muted)]">{p.caption}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
