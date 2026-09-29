"use client";
import { CrudPage } from "@/components/admin/CrudPage";
import { NestedCrud } from "@/components/admin/NestedCrud";
import type { FieldDef, Row } from "@/components/admin/AdminTable";

type Species = Row & { key: string; label: string; breeds?: Row[] };

const fields: FieldDef[] = [
  { key: "key", label: "Chave", required: true, placeholder: "dog" },
  { key: "label", label: "Nome", required: true, placeholder: "Cachorro" },
  { key: "sortOrder", label: "Ordem", type: "number" },
  { key: "active", label: "Ativa", type: "checkbox" },
];
const breedFields: FieldDef[] = [
  { key: "name", label: "Raça", required: true },
  { key: "isMixed", label: "SRD (sem raça definida)", type: "checkbox" },
  { key: "isOther", label: "Opção \"Outra\"", type: "checkbox" },
];

export default function EspeciesPage() {
  return (
    <CrudPage<Species>
      resource="species"
      title="Espécies e raças"
      description="Espécies aceitas no cadastro de pets. Expanda uma espécie para gerenciar as raças."
      fields={fields}
      columns={[
        { key: "label", label: "Espécie" },
        { key: "key", label: "Chave", render: (r) => <code className="text-xs">{r.key}</code> },
        { key: "sortOrder", label: "Ordem" },
        { key: "active", label: "Ativa" },
        { key: "breeds", label: "Raças", render: (r) => (Array.isArray(r.breeds) ? r.breeds.length : "—") },
      ]}
      sort={(a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)}
      expand={(r) => (
        <NestedCrud
          resource="breeds"
          parentResource="species"
          parentKey="speciesId"
          parentId={r.id}
          title={`Nova raça de ${r.label}`}
          fields={breedFields}
          columns={[
            { key: "name", label: "Raça" },
            { key: "isMixed", label: "SRD" },
            { key: "isOther", label: "Outra" },
          ]}
        />
      )}
    />
  );
}
