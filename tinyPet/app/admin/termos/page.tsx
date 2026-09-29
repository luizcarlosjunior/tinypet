"use client";
import { CrudPage } from "@/components/admin/CrudPage";
import type { FieldDef } from "@/components/admin/AdminTable";

const fields: FieldDef[] = [
  { key: "label", label: "Termo", required: true, placeholder: "Tutor" },
  { key: "sortOrder", label: "Ordem", type: "number" },
  { key: "isDefault", label: "Padrão", type: "checkbox" },
  { key: "active", label: "Ativo", type: "checkbox" },
];

export default function TermosPage() {
  return (
    <CrudPage
      resource="owner-terms"
      title="Termos do tutor"
      description="Como o cliente final prefere ser chamado (Tutor, Dono, Pai de pet…). O padrão é usado em novas contas."
      fields={fields}
      columns={[
        { key: "label", label: "Termo" },
        { key: "sortOrder", label: "Ordem" },
        { key: "isDefault", label: "Padrão" },
        { key: "active", label: "Ativo" },
      ]}
    />
  );
}
