"use client";
import { CrudPage } from "@/components/admin/CrudPage";
import { useSpecies } from "@/hooks/use-ref";
import type { FieldDef, Row } from "@/components/admin/AdminTable";

type Skill = Row & { name: string; key?: string | null; speciesKey?: string | null; species?: { key: string; label: string } | null; isCustom?: boolean };

export default function ComandosPage() {
  const species = useSpecies();
  const opts = (species.data ?? []).map((s) => ({ value: s.key, label: s.label }));
  const fields: FieldDef[] = [
    { key: "name", label: "Comando", required: true, placeholder: "Senta" },
    { key: "key", label: "Chave", placeholder: "sit", emptyAs: "omit" },
    { key: "speciesKey", label: "Espécie (vazio = todas)", type: "select", options: opts, valueOf: (r) => (r as Skill).species?.key ?? (r as Skill).speciesKey ?? null },
  ];
  return (
    <CrudPage<Skill>
      resource="skills"
      title="Comandos"
      description="Comandos e truques sugeridos aos tutores. Comandos personalizados criados por usuários aparecem marcados."
      fields={fields}
      columns={[
        { key: "name", label: "Comando" },
        { key: "key", label: "Chave" },
        { key: "speciesKey", label: "Espécie", render: (r) => r.species?.label ?? (r.speciesKey ? opts.find((o) => o.value === r.speciesKey)?.label ?? r.speciesKey : "Todas") },
        { key: "isCustom", label: "Personalizado" },
      ]}
    />
  );
}
