"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { LIFE_STAGE_LABEL, ageInMonths, formatAge, lifeStageFor } from "@tinypet/shared";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { Pagination, QueryState, Table, td, th } from "@/components/painel/ui";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { BarList } from "@/components/painel/relatorios/BarList";
import { useActivePartner } from "@/hooks/use-partner";
import { useSpecies } from "@/hooks/use-ref";
import { useBrandsReport, usePetReport, type PetReportItem } from "@/hooks/use-reports";
import { MONTHS, fmtPhone } from "@/lib/format";
import { isPlanLimit } from "@/lib/errors";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const GROUP_BY = [
  { key: "state", label: "Estado" },
  { key: "city", label: "Cidade" },
  { key: "species", label: "Espécie" },
  { key: "breed", label: "Raça" },
  { key: "lifeStage", label: "Fase da vida" },
  { key: "birthMonth", label: "Mês de nascimento" },
  { key: "createdMonth", label: "Mês de cadastro" },
];
const SEX_LABEL: Record<string, string> = { MALE: "Macho", FEMALE: "Fêmea" };
const SIZE_LABEL: Record<string, string> = { SMALL: "Pequeno", MEDIUM: "Médio", LARGE: "Grande", GIANT: "Gigante" };

type Filters = Record<string, string>;
const EMPTY: Filters = { species: "", breedId: "", lifeStage: "", bornFrom: "", bornTo: "", birthMonth: "", ageMinMonths: "", ageMaxMonths: "", state: "", city: "", district: "", sex: "", size: "", neutered: "", status: "", tag: "", groupBy: "species" };

function toQuery(f: Filters, page: number) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) s.set(k, v);
  s.set("page", String(page));
  s.set("pageSize", "20");
  return s.toString();
}

export default function RelatoriosPage() {
  const { partnerId } = useActivePartner();
  const species = useSpecies();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const query = useMemo(() => toQuery(applied, page), [applied, page]);
  const report = usePetReport(partnerId, query);
  const brands = useBrandsReport(partnerId);
  const breeds = species.data?.find((s) => s.key === draft.species)?.breeds ?? [];
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value, ...(k === "species" ? { breedId: "" } : {}) }));

  const exportHref = `/api/v1/reports/pets/export?${toQuery(applied, 1)}${partnerId ? `&partnerId=${partnerId}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Relatórios de pets"
        description="Sua carteira de pets por espécie, raça, fase da vida e localização."
        actions={
          <a href={exportHref} target="_blank" rel="noreferrer" className="btn-secondary">
            <Download className="h-4 w-4" aria-hidden /> Exportar CSV
          </a>
        }
      />

      <form
        className="card mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(draft);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Select id="f-species" label="Espécie" value={draft.species} onChange={set("species")}>
            <option value="">Todas</option>
            {(species.data ?? []).map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select id="f-breed" label="Raça" value={draft.breedId} onChange={set("breedId")} disabled={!breeds.length}>
            <option value="">Todas</option>
            {breeds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select id="f-stage" label="Fase da vida" value={draft.lifeStage} onChange={set("lifeStage")}>
            <option value="">Todas</option>
            <option value="PUPPY">Filhote</option>
            <option value="ADULT">Adulto</option>
            <option value="SENIOR">Idoso</option>
          </Select>
          <Select id="f-month" label="Mês de aniversário" value={draft.birthMonth} onChange={set("birthMonth")}>
            <option value="">Todos</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
          <Input id="f-bornFrom" label="Nascido de" type="date" value={draft.bornFrom} onChange={set("bornFrom")} />
          <Input id="f-bornTo" label="Nascido até" type="date" value={draft.bornTo} onChange={set("bornTo")} />
          <Input id="f-ageMin" label="Idade mín. (meses)" type="number" min={0} value={draft.ageMinMonths} onChange={set("ageMinMonths")} />
          <Input id="f-ageMax" label="Idade máx. (meses)" type="number" min={0} value={draft.ageMaxMonths} onChange={set("ageMaxMonths")} />
          <Select id="f-state" label="UF" value={draft.state} onChange={set("state")}>
            <option value="">Todas</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
          <Input id="f-city" label="Cidade" value={draft.city} onChange={set("city")} />
          <Input id="f-district" label="Bairro" value={draft.district} onChange={set("district")} />
          <Select id="f-sex" label="Sexo" value={draft.sex} onChange={set("sex")}>
            <option value="">Todos</option>
            <option value="MALE">Macho</option>
            <option value="FEMALE">Fêmea</option>
          </Select>
          <Select id="f-size" label="Porte" value={draft.size} onChange={set("size")}>
            <option value="">Todos</option>
            <option value="SMALL">Pequeno</option>
            <option value="MEDIUM">Médio</option>
            <option value="LARGE">Grande</option>
            <option value="GIANT">Gigante</option>
          </Select>
          <Select id="f-neutered" label="Castrado" value={draft.neutered} onChange={set("neutered")}>
            <option value="">Todos</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </Select>
          <Select id="f-status" label="Status" value={draft.status} onChange={set("status")}>
            <option value="">Ativos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="DECEASED">Falecido</option>
          </Select>
          <Input id="f-tag" label="Etiqueta do cliente" value={draft.tag} onChange={set("tag")} placeholder="VIP" />
          <Select id="f-group" label="Agrupar por" value={draft.groupBy} onChange={set("groupBy")}>
            {GROUP_BY.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraft(EMPTY);
              setApplied(EMPTY);
              setPage(1);
            }}
          >
            Limpar
          </Button>
          <Button type="submit">Aplicar</Button>
        </div>
      </form>

      {isPlanLimit(report.error) ? (
        <PlanLimitNotice error={report.error} />
      ) : (
        <QueryState isLoading={report.isLoading} error={report.error} retry={() => report.refetch()}>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title={`Pets por ${GROUP_BY.find((g) => g.key === applied.groupBy)?.label.toLowerCase() ?? "grupo"}`} className="lg:col-span-1">
              <p className="mb-3 text-2xl font-bold">
                {report.data?.total ?? 0} <span className="text-sm font-normal text-[var(--muted)]">pets</span>
              </p>
              <BarList groups={(report.data?.groups ?? []).map((g) => ({ key: labelGroup(applied.groupBy, g.key), count: g.count }))} label="Distribuição" />
            </Card>
            <div className="lg:col-span-2">
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Pet</th>
                    <th className={th}>Tutor / cliente</th>
                    <th className={th}>Espécie / raça</th>
                    <th className={th}>Idade</th>
                    <th className={th}>Fase</th>
                    <th className={th}>Cidade/UF</th>
                    <th className={th}>Contato</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.data?.items ?? []).length === 0 && (
                    <tr>
                      <td className={`${td} text-center text-[var(--muted)]`} colSpan={7}>
                        Nenhum pet encontrado com esses filtros.
                      </td>
                    </tr>
                  )}
                  {(report.data?.items ?? []).map((p) => <Row key={p.id} p={p} />)}
                </tbody>
              </Table>
              <Pagination page={page} pageSize={20} total={report.data?.total ?? 0} onChange={setPage} />
            </div>
          </div>
        </QueryState>
      )}

      <Card title="Demanda por marca de ração" className="mt-6">
        <p className="mb-3 text-sm text-[var(--muted)]">Marcas mais usadas pelos pets da região, para orientar estoque e ofertas.</p>
        {brands.isLoading ? (
          <p className="text-sm text-[var(--muted)]">Carregando…</p>
        ) : brands.error ? (
          isPlanLimit(brands.error) ? (
            <PlanLimitNotice error={brands.error} compact />
          ) : (
            <p className="text-sm text-[var(--muted)]">Relatório indisponível no momento.</p>
          )
        ) : (
          <BrandsTable data={brands.data} />
        )}
      </Card>
    </div>
  );
}

function Row({ p }: { p: PetReportItem }) {
  const speciesLabel = typeof p.species === "string" ? p.species : p.species?.label ?? p.speciesLabel ?? "—";
  const speciesKey = typeof p.species === "string" ? p.species : p.species?.key ?? "";
  const breed = typeof p.breed === "string" ? p.breed : p.breed?.name ?? p.breedName ?? "";
  const months = p.ageMonths ?? ageInMonths(p.birthDate, p.approxAgeMonths);
  const stage = p.lifeStage ?? lifeStageFor(months, speciesKey, p.size);
  const client = p.client?.name ?? p.clientName ?? p.ownerName ?? "—";
  const phone = p.client?.phone ?? p.phone ?? p.contact ?? "";
  return (
    <tr>
      <td className={td}>
        <span className="font-medium">{p.name}</span>
        {p.status === "DECEASED" && <span className="ml-1 text-xs text-[var(--muted)]">(falecido)</span>}
        <span className="block text-xs text-[var(--muted)]">{[p.sex ? SEX_LABEL[p.sex] : null, p.size ? SIZE_LABEL[p.size] : null].filter(Boolean).join(" · ")}</span>
      </td>
      <td className={td}>{client}</td>
      <td className={td}>
        {speciesLabel}
        {breed && <span className="block text-xs text-[var(--muted)]">{breed}</span>}
      </td>
      <td className={td}>{formatAge(months)}</td>
      <td className={td}>{stage ? LIFE_STAGE_LABEL[stage] : "—"}</td>
      <td className={td}>{[p.city, p.state].filter(Boolean).join("/") || "—"}</td>
      <td className={td}>{phone ? fmtPhone(phone) : "—"}</td>
    </tr>
  );
}

function labelGroup(groupBy: string, key: string): string {
  if (groupBy === "lifeStage" && key in LIFE_STAGE_LABEL) return LIFE_STAGE_LABEL[key as keyof typeof LIFE_STAGE_LABEL];
  if (groupBy === "birthMonth") {
    const n = parseInt(key, 10);
    if (n >= 1 && n <= 12) return MONTHS[n - 1]!;
  }
  return key || "Não informado";
}

function BrandsTable({ data }: { data: unknown }) {
  const rows: Record<string, unknown>[] = Array.isArray(data) ? (data as Record<string, unknown>[]) : data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items) ? ((data as { items: Record<string, unknown>[] }).items) : [];
  if (!rows.length) return <p className="text-sm text-[var(--muted)]">Ainda não há dados de alimentação dos pets.</p>;
  const str = (v: unknown) => (v == null ? "" : typeof v === "object" ? String((v as { name?: unknown }).name ?? "") : String(v));
  return (
    <Table>
      <thead>
        <tr>
          <th className={th}>Marca</th>
          <th className={th}>Linha</th>
          <th className={th}>Cidade</th>
          <th className={th}>Pets</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className={td}>{str(r.brand ?? r.brandName ?? r.name) || "—"}</td>
            <td className={td}>{str(r.line ?? r.productLine ?? r.lineName) || "—"}</td>
            <td className={td}>{[str(r.city), str(r.state)].filter(Boolean).join("/") || "—"}</td>
            <td className={td}>{str(r.count ?? r.pets ?? r.total) || "—"}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
