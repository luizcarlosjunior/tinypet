import { haversineKm } from "@tinypet/shared";

export type CepResult = { zipCode: string; street: string; district: string; city: string; state: string; complement?: string };

export async function lookupCep(cep: string): Promise<CepResult | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { next: { revalidate: 86400 } });
    const j = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string; complemento?: string };
    if (j.erro) return null;
    return { zipCode: `${d.slice(0, 5)}-${d.slice(5)}`, street: j.logradouro ?? "", district: j.bairro ?? "", city: j.localidade ?? "", state: j.uf ?? "", complement: j.complemento };
  } catch {
    return null;
  }
}

export async function lookupCnpj(cnpj: string): Promise<{ legalName: string; tradeName?: string } | null> {
  const d = cnpj.replace(/\D/g, "");
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
    if (!res.ok) return null;
    const j = (await res.json()) as { razao_social?: string; nome_fantasia?: string };
    return j.razao_social ? { legalName: j.razao_social, tradeName: j.nome_fantasia || undefined } : null;
  } catch {
    return null;
  }
}

/** Geocodes an address. Uses Google if key is present, else Nominatim (OSM). */
export async function geocode(addr: { street: string; number?: string | null; district?: string | null; city: string; state: string; zipCode?: string }): Promise<{ lat: number; lng: number } | null> {
  const text = [addr.street, addr.number, addr.district, addr.city, addr.state, "Brasil"].filter(Boolean).join(", ");
  try {
    if (process.env.GOOGLE_MAPS_API_KEY) {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&key=${process.env.GOOGLE_MAPS_API_KEY}`);
      const j = (await res.json()) as { results?: { geometry: { location: { lat: number; lng: number } } }[] };
      const loc = j.results?.[0]?.geometry.location;
      return loc ? { lat: loc.lat, lng: loc.lng } : null;
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(text)}`, { headers: { "User-Agent": "tinyPet/0.1 (dev)" } });
    const j = (await res.json()) as { lat: string; lon: string }[];
    return j[0] ? { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) } : null;
  } catch {
    return null;
  }
}

export type TravelEstimate = { distanceKm: number; durationMinutes: number; estimated: boolean };

const travelCache = new Map<string, TravelEstimate>();

/** Google Routes API with cache; falls back to straight-line × 1.3 at 30 km/h. */
export async function estimateTravel(from: { lat: number; lng: number }, to: { lat: number; lng: number }, departAt?: Date): Promise<TravelEstimate> {
  const hourKey = departAt ? departAt.toISOString().slice(0, 13) : "any";
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}@${hourKey}`;
  const cached = travelCache.get(key);
  if (cached) return cached;

  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
          destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          ...(departAt && departAt > new Date() ? { departureTime: departAt.toISOString() } : {}),
        }),
      });
      const j = (await res.json()) as { routes?: { duration: string; distanceMeters: number }[] };
      const r = j.routes?.[0];
      if (r) {
        const est = { distanceKm: Math.round(r.distanceMeters / 100) / 10, durationMinutes: Math.ceil(parseInt(r.duration, 10) / 60), estimated: false };
        travelCache.set(key, est);
        return est;
      }
    } catch (e) {
      console.warn("[routes] fallback", e);
    }
  }
  const straight = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const distanceKm = Math.round(straight * 1.3 * 10) / 10;
  const est = { distanceKm, durationMinutes: Math.max(5, Math.ceil((distanceKm / 30) * 60)), estimated: true };
  travelCache.set(key, est);
  return est;
}
