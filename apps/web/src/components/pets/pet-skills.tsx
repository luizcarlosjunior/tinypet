"use client";
import { useState } from "react";
import { BadgeCheck, Plus, Trash2, TrendingUp } from "lucide-react";
import { usePetMutation, usePetResource } from "@/hooks/use-pets";
import { useGeolocation } from "@/hooks/use-geolocation";
import { Button, Empty, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { toDateKey, fmtDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type Level = "LEARNING" | "SOMETIMES" | "MASTERED";
type SkillRow = { skillId: string; name: string; level: Level; masteredAt: string | null; validated: boolean; markedBy?: { kind: "user" | "partner"; id: string; name?: string; tradeName?: string } | null; isCustom?: boolean };
/** GET /pets/:id/skills → available items are `{ skillId, name, key }` (system skills of the species not yet marked). */
type SkillsData = { skills: SkillRow[]; available: { skillId: string; name: string; key?: string | null }[] };
type ComparisonScope = { label: "nearMe" | "city" | "state" | "Brasil"; city: string | null; state: string | null; breed?: { id: string; name: string } | null };
type Comparison = { scope: ComparisonScope | null; groupSize: number; widened: boolean; perSkill: { skillId: string; name: string; pct: number }[]; summary: { mastered: number; percentile: number | null }; note?: string };

const LEVELS: [Level, string][] = [["LEARNING", "Aprendendo"], ["SOMETIMES", "Às vezes"], ["MASTERED", "Domina"]];
const SCOPE_LABEL: Record<ComparisonScope["label"], string> = { nearMe: "perto de você", city: "na sua cidade", state: "no seu estado", Brasil: "no Brasil" };
function scopeText(s: ComparisonScope | null): string {
  if (!s) return "";
  const where = s.label === "city" || s.label === "nearMe" ? (s.city ? `em ${s.city}` : SCOPE_LABEL[s.label]) : s.label === "state" ? (s.state ? `em ${s.state}` : SCOPE_LABEL.state) : SCOPE_LABEL.Brasil;
  return `${s.breed?.name ? `da raça ${s.breed.name} ` : ""}${where}`;
}

export function PetSkills({ petId, deceased: isDeceased, readOnly = false }: { petId: string; deceased: boolean; readOnly?: boolean }) {
  // shared accounts see the skills but can't change them (same locks as a memorial profile)
  const deceased = isDeceased || readOnly;
  const q = usePetResource<SkillsData>(petId, "skills");
  const put = usePetMutation<{ skillId?: string; customName?: string; level: Level; masteredAt?: string | null }>(petId, "skills", "PUT", ["skills", "history"]);
  const del = usePetMutation(petId, "skills", "DELETE", ["skills"]);
  const { toast } = useToast();
  const [custom, setCustom] = useState("");
  const [filters, setFilters] = useState({ breed: false, city: false, state: false, nearMe: false });
  const geo = useGeolocation();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, "1");
  if (filters.nearMe && geo.coords) {
    qs.set("lat", String(geo.coords.lat));
    qs.set("lng", String(geo.coords.lng));
  }
  const cmp = usePetResource<Comparison>(petId, "skills/comparison", qs.toString() ? `?${qs}` : "");

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <Empty title="Não foi possível carregar os comandos" description={errorMessage(q.error)} />;
  const skills = q.data?.skills ?? [];
  const available = (q.data?.available ?? []).filter((a) => !skills.some((s) => s.skillId === a.skillId));

  function setLevel(skillId: string, level: Level) {
    put.mutateAsync({ body: { skillId, level, masteredAt: level === "MASTERED" ? toDateKey() : null } }).catch((e) => toast(errorMessage(e), "error"));
  }
  async function toggleNear() {
    const on = !filters.nearMe;
    if (on && !geo.coords) {
      const c = await geo.locate();
      if (!c) return;
    }
    setFilters((f) => ({ ...f, nearMe: on }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {skills.length === 0 ? (
          <Empty title="Nenhum comando registrado" description="Marque o que seu pet já sabe fazer e compare com pets semelhantes." />
        ) : (
          <ul className="divide-y rounded-2xl border">
            {skills.map((s) => (
              <li key={s.skillId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-[140px] flex-1">
                  <p className="inline-flex items-center gap-1 text-sm font-medium">
                    {s.name}
                    {s.validated && (
                      <span className="badge bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" title="Validado por adestrador">
                        <BadgeCheck className="mr-1 h-3 w-3" aria-hidden /> Validado
                      </span>
                    )}
                  </p>
                  {s.masteredAt && <p className="text-xs text-[var(--muted)]">Dominado em {fmtDay(s.masteredAt)}</p>}
                </div>
                <div role="radiogroup" aria-label={`Nível de ${s.name}`} className="inline-flex rounded-xl border p-0.5">
                  {LEVELS.map(([lv, label]) => (
                    <button key={lv} type="button" role="radio" aria-checked={s.level === lv} disabled={deceased} onClick={() => setLevel(s.skillId, lv)} className={cn("rounded-lg px-2.5 py-1 text-xs", s.level === lv ? (lv === "MASTERED" ? "bg-emerald-600 text-white" : "bg-brand-500 text-white") : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
                      {label}
                    </button>
                  ))}
                </div>
                {!deceased && (
                  <button type="button" onClick={() => del.mutateAsync({ path: `/${s.skillId}` }).catch((e) => toast(errorMessage(e), "error"))} className="btn-ghost h-8 w-8 px-0 text-red-600" aria-label={`Remover ${s.name}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!deceased && (
          <div className="card space-y-3">
            <p className="text-sm font-semibold">Adicionar comando</p>
            {available.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {available.map((a) => (
                  <li key={a.skillId}>
                    <button type="button" onClick={() => setLevel(a.skillId, "LEARNING")} className="btn-secondary h-8 px-3 text-xs">
                      <Plus className="h-3 w-3" aria-hidden /> {a.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!custom.trim()) return;
                put.mutateAsync({ body: { customName: custom.trim(), level: "LEARNING" } }).then(() => setCustom("")).catch((err) => toast(errorMessage(err), "error"));
              }}
              className="flex gap-2"
            >
              <Input id="custom-skill" aria-label="Comando personalizado" placeholder="Comando personalizado (ex.: pega a bolinha)" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-9" />
              <Button type="submit" variant="secondary" className="h-9 shrink-0" disabled={!custom.trim()} loading={put.isPending}>
                Adicionar
              </Button>
            </form>
          </div>
        )}
      </div>

      <aside className="card h-fit space-y-3" aria-labelledby="comparativo">
        <h3 id="comparativo" className="inline-flex items-center gap-2 font-semibold">
          <TrendingUp className="h-4 w-4" aria-hidden /> Comparativo
        </h3>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtros do comparativo">
          {([["breed", "Raça"], ["city", "Cidade"], ["state", "Estado"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filters[k]} onClick={() => setFilters((f) => ({ ...f, [k]: !f[k] }))} className={cn("rounded-full border px-3 py-1 text-xs", filters[k] ? "border-brand-500 bg-brand-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
              {l}
            </button>
          ))}
          <button type="button" aria-pressed={filters.nearMe} onClick={toggleNear} className={cn("rounded-full border px-3 py-1 text-xs", filters.nearMe ? "border-brand-500 bg-brand-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
            Perto de mim
          </button>
        </div>
        {geo.error && <p className="text-xs text-red-600">{geo.error}</p>}
        {cmp.isLoading ? (
          <Spinner />
        ) : cmp.isError || !cmp.data ? (
          <p className="text-xs text-[var(--muted)]">Comparativo indisponível no momento.</p>
        ) : (
          <>
            {cmp.data.summary?.percentile != null && (
              <p className="text-sm">
                <strong>{cmp.data.summary.mastered}</strong> comandos dominados · sabe mais que <strong>{Math.round(cmp.data.summary.percentile)}%</strong> dos pets {scopeText(cmp.data.scope)}.
              </p>
            )}
            {cmp.data.note && <p className="text-xs text-[var(--muted)]">{cmp.data.note}</p>}
            <p className="text-xs text-[var(--muted)]">
              Grupo de {cmp.data.groupSize} pets{cmp.data.widened ? " · escopo ampliado para ter uma amostra mínima" : ""}.
            </p>
            <ul className="space-y-2">
              {cmp.data.perSkill.map((s) => (
                <li key={s.skillId} className="text-xs">
                  <div className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="font-medium">{Math.round(s.pct)}%</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                    <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, s.pct)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-[11px] text-[var(--muted)]">Percentuais recalculados diariamente. Comandos personalizados ficam fora do comparativo.</p>
      </aside>
    </div>
  );
}
