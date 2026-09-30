"use client";
import { useQuery } from "@tanstack/react-query";
import { Dna } from "lucide-react";
import { safeHref } from "@tinypet/shared";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Range = { min: number; max: number };
type Trait = { key: string; label: string; value: number; low: string; high: string };
export type BreedInfo = {
  species: "dog" | "cat";
  externalName: string;
  imageUrl: string | null;
  lifeYears: Range | null;
  weightKg: { male?: Range | null; female?: Range | null; any?: Range | null };
  heightCm: { male?: Range | null; female?: Range | null } | null;
  origin: string | null;
  traits: Trait[];
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const r = (x: Range | null | undefined, unit: string) => (x ? (x.min === x.max ? `${fmt(x.min)} ${unit}` : `${fmt(x.min)}–${fmt(x.max)} ${unit}`) : null);

export function useBreedInfo(breedId: string | null | undefined) {
  return useQuery({ queryKey: ["breed-info", breedId], queryFn: () => api<BreedInfo | null>(`/ref/breeds/${breedId}/info`, { partnerId: null }), enabled: !!breedId, staleTime: 24 * 3_600_000, retry: false });
}

/** "Sobre a raça": typical facts for dogs/cats (data replicated from API Ninjas; hidden when unknown). */
export function BreedInfoCard({ breedId, breedName, sex }: { breedId: string | null | undefined; breedName?: string | null; sex?: "MALE" | "FEMALE" | null }) {
  const q = useBreedInfo(breedId);
  const info = q.data;
  if (!breedId || q.isLoading || !info) return null;
  const weight =
    info.weightKg.any !== undefined
      ? r(info.weightKg.any, "kg")
      : [info.weightKg.male && `machos ${r(info.weightKg.male, "kg")}`, info.weightKg.female && `fêmeas ${r(info.weightKg.female, "kg")}`].filter(Boolean).join(" · ") || null;
  const height = info.heightCm ? [info.heightCm.male && `machos ${r(info.heightCm.male, "cm")}`, info.heightCm.female && `fêmeas ${r(info.heightCm.female, "cm")}`].filter(Boolean).join(" · ") || null : null;
  const mine = sex === "MALE" ? info.weightKg.male : sex === "FEMALE" ? info.weightKg.female : null;
  const facts = [
    ["Expectativa de vida", r(info.lifeYears, "anos")],
    ["Peso típico", weight],
    ["Altura típica", height],
    ["Origem", info.origin],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <section className="card" aria-labelledby="breed-info-title">
      <div className="flex gap-4">
        {info.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeHref(info.imageUrl)} alt={`Foto ilustrativa da raça ${breedName ?? info.externalName}`} className="h-24 w-24 shrink-0 rounded-xl object-cover" loading="lazy" />
        )}
        <div className="min-w-0 flex-1">
          <h3 id="breed-info-title" className="inline-flex items-center gap-2 font-semibold">
            <Dna className="h-4 w-4" aria-hidden /> Sobre a raça {breedName ?? info.externalName}
          </h3>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-[var(--muted)]">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {mine && <p className="mt-1 text-xs text-[var(--muted)]">Para {sex === "MALE" ? "machos" : "fêmeas"} da raça, o peso costuma ficar entre {r(mine, "kg")}.</p>}
        </div>
      </div>
      {info.traits.length > 0 && (
        <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {info.traits.map((t) => (
            <li key={t.key}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium">{t.label}</span>
                <span className="text-[var(--muted)]">{t.value <= 2 ? t.low : t.value >= 4 ? t.high : "Médio"}</span>
              </div>
              <div className="mt-1 flex gap-1" role="meter" aria-label={t.label} aria-valuemin={1} aria-valuemax={5} aria-valuenow={t.value}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= t.value ? "bg-brand-500" : "bg-ink-200 dark:bg-ink-700")} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-[var(--muted)]">Valores típicos da raça — cada pet é único. Dados: API Ninjas.</p>
    </section>
  );
}
