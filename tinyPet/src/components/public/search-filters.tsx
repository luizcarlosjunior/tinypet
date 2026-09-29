"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { LocateFixed, SlidersHorizontal, X } from "lucide-react";
import { useCategories, usePartnerTypes, useSpecies } from "@/hooks/use-ref";
import { useGeolocation } from "@/hooks/use-geolocation";
import { PARTNER_TYPES, SPECIES } from "@tinypet/shared";
import { cn } from "@/lib/utils";

export function SearchFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const types = usePartnerTypes();
  const categories = useCategories();
  const species = useSpecies();
  const geo = useGeolocation();

  const get = (k: string) => sp.get(k) ?? "";
  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [sp, router, pathname],
  );

  async function nearMe() {
    if (get("lat")) return update({ lat: null, lng: null, radiusKm: null });
    const c = await geo.locate();
    if (c) update({ lat: String(c.lat), lng: String(c.lng), radiusKm: get("radiusKm") || "20", city: null });
  }

  const active = ["type", "category", "species", "minRating", "city", "lat"].filter((k) => get(k)).length;
  const typeList = types.data?.length ? types.data : PARTNER_TYPES.map((t) => ({ key: t.key, label: t.label }));
  const speciesList = species.data?.length ? species.data : SPECIES.map((s) => ({ key: s.key, label: s.label }));

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              update({ q: String(fd.get("q") || "") });
            }}
            className="flex min-w-[200px] flex-1 gap-2"
            role="search"
          >
            <label htmlFor="busca-q" className="sr-only">
              O que você procura
            </label>
            <input id="busca-q" name="q" defaultValue={get("q")} placeholder="O que você procura?" className="input h-10" />
            <button type="submit" className="btn-primary h-10">
              Buscar
            </button>
          </form>
          <button type="button" onClick={nearMe} aria-pressed={!!get("lat")} className={cn("btn-secondary h-10", get("lat") && "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100")} disabled={geo.loading}>
            <LocateFixed className="h-4 w-4" aria-hidden /> {geo.loading ? "Localizando…" : "Perto de mim"}
          </button>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="filtros" className="btn-ghost h-10 md:hidden">
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filtros{active ? ` (${active})` : ""}
          </button>
        </div>
      </div>
      {geo.error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {geo.error}
        </p>
      )}
      <div id="filtros" className={cn("mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5", open ? "grid" : "hidden md:grid")}>
        <SelectFilter id="f-type" label="Tipo" value={get("type")} onChange={(v) => update({ type: v })} options={typeList.map((t) => [t.key, t.label])} />
        <SelectFilter id="f-cat" label="Categoria" value={get("category")} onChange={(v) => update({ category: v })} options={(categories.data ?? []).map((c) => [c.key, c.label])} />
        <SelectFilter id="f-species" label="Espécie" value={get("species")} onChange={(v) => update({ species: v })} options={speciesList.map((s) => [s.key, s.label])} />
        <SelectFilter id="f-rating" label="Nota mínima" value={get("minRating")} onChange={(v) => update({ minRating: v })} options={[["4.5", "4,5 ou mais"], ["4", "4 ou mais"], ["3", "3 ou mais"]]} />
        <div>
          <label htmlFor="f-city" className="label">
            Cidade
          </label>
          <input
            id="f-city"
            defaultValue={get("city")}
            key={get("city")}
            onBlur={(e) => e.target.value !== get("city") && update({ city: e.target.value, lat: null, lng: null })}
            onKeyDown={(e) => e.key === "Enter" && update({ city: (e.target as HTMLInputElement).value, lat: null, lng: null })}
            placeholder="Ex.: Curitiba"
            className="input h-10"
          />
        </div>
      </div>
      {active > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--muted)]">Filtros ativos:</span>
          {get("lat") && <Chip label={`Até ${get("radiusKm") || 20} km de mim`} onRemove={() => update({ lat: null, lng: null, radiusKm: null })} />}
          {get("type") && <Chip label={typeList.find((t) => t.key === get("type"))?.label ?? get("type")} onRemove={() => update({ type: null })} />}
          {get("category") && <Chip label={categories.data?.find((c) => c.key === get("category"))?.label ?? get("category")} onRemove={() => update({ category: null })} />}
          {get("species") && <Chip label={speciesList.find((s) => s.key === get("species"))?.label ?? get("species")} onRemove={() => update({ species: null })} />}
          {get("minRating") && <Chip label={`Nota ≥ ${get("minRating").replace(".", ",")}`} onRemove={() => update({ minRating: null })} />}
          {get("city") && <Chip label={get("city")} onRemove={() => update({ city: null })} />}
          <button type="button" onClick={() => router.push(pathname)} className="text-brand-600 hover:underline">
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}

function SelectFilter({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input h-10">
        <option value="">Todos</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="badge bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remover filtro ${label}`} className="ml-1 rounded-full hover:bg-brand-200 dark:hover:bg-brand-800">
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}
