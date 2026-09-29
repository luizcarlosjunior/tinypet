"use client";
import { CrudPage } from "@/components/admin/CrudPage";
import { useSpecies } from "@/hooks/use-ref";
import type { FieldDef, Row } from "@/components/admin/AdminTable";

type Rule = Row & { speciesId: string; size?: string | null; puppyUntilMonths: number; seniorFromMonths: number; species?: { label: string } | null };
const SIZES = [
  { value: "SMALL", label: "Pequeno" },
  { value: "MEDIUM", label: "Médio" },
  { value: "LARGE", label: "Grande" },
  { value: "GIANT", label: "Gigante" },
];

export default function FasesPage() {
  const species = useSpecies();
  const opts = (species.data ?? []).map((s) => ({ value: s.id, label: s.label }));
  const fields: FieldDef[] = [
    { key: "speciesId", label: "Espécie", type: "select", options: opts, required: true },
    { key: "size", label: "Porte (opcional)", type: "select", options: SIZES },
    { key: "puppyUntilMonths", label: "Filhote até (meses)", type: "number", required: true },
    { key: "seniorFromMonths", label: "Idoso a partir de (meses)", type: "number", required: true },
  ];
  return (
    <CrudPage<Rule>
      resource="life-stage-rules"
      title="Fases da vida"
      description="Regras de idade por espécie e porte para classificar filhote, adulto e idoso."
      fields={fields}
      columns={[
        { key: "speciesId", label: "Espécie", render: (r) => r.species?.label ?? opts.find((o) => o.value === r.speciesId)?.label ?? r.speciesId },
        { key: "size", label: "Porte", render: (r) => SIZES.find((s) => s.value === r.size)?.label ?? "Todos" },
        { key: "puppyUntilMonths", label: "Filhote até", render: (r) => `${r.puppyUntilMonths} meses` },
        { key: "seniorFromMonths", label: "Idoso a partir de", render: (r) => `${r.seniorFromMonths} meses` },
      ]}
    />
  );
}
