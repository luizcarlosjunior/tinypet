"use client";
import { CrudPage } from "@/components/admin/CrudPage";
import { NestedCrud } from "@/components/admin/NestedCrud";
import type { FieldDef, Row } from "@/components/admin/AdminTable";

type Category = Row & { key: string; label: string; sortOrder?: number; active?: boolean; subcategories?: Row[] };

const fields: FieldDef[] = [
  { key: "key", label: "Chave", required: true, placeholder: "saude" },
  { key: "label", label: "Nome", required: true, placeholder: "Saúde" },
  { key: "sortOrder", label: "Ordem", type: "number" },
  { key: "active", label: "Ativa", type: "checkbox" },
];
const subFields: FieldDef[] = [
  { key: "key", label: "Chave", required: true },
  { key: "label", label: "Nome", required: true },
  { key: "sortOrder", label: "Ordem", type: "number" },
  { key: "active", label: "Ativa", type: "checkbox" },
];

export default function CategoriasPage() {
  return (
    <CrudPage<Category>
      resource="categories"
      title="Categorias"
      description="Categorias e subcategorias do catálogo. Expanda uma categoria para gerenciar as subcategorias."
      fields={fields}
      columns={[
        { key: "label", label: "Nome" },
        { key: "key", label: "Chave", render: (r) => <code className="text-xs">{r.key}</code> },
        { key: "sortOrder", label: "Ordem" },
        { key: "active", label: "Ativa" },
        { key: "subcategories", label: "Subcategorias", render: (r) => (Array.isArray(r.subcategories) ? r.subcategories.length : "—") },
      ]}
      sort={(a, b) => (Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)) || String(a.label).localeCompare(String(b.label))}
      expand={(r) => (
        <NestedCrud
          resource="subcategories"
          parentResource="categories"
          parentKey="categoryId"
          parentId={r.id}
          title={`Nova subcategoria em ${r.label}`}
          fields={subFields}
          columns={[
            { key: "label", label: "Nome" },
            { key: "key", label: "Chave" },
            { key: "sortOrder", label: "Ordem" },
            { key: "active", label: "Ativa" },
          ]}
        />
      )}
    />
  );
}
