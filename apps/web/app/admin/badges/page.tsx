"use client";
import { CrudPage } from "@/components/admin/CrudPage";
import type { FieldDef, Row } from "@/components/admin/AdminTable";

type Badge = Row & { key: string; name: string; description?: string | null; iconUrl?: string | null; partnerId?: string | null };
const fields: FieldDef[] = [
  { key: "key", label: "Chave", required: true, placeholder: "first_steps" },
  { key: "name", label: "Nome", required: true },
  { key: "description", label: "Descrição" },
  { key: "iconUrl", label: "URL do ícone", type: "url" },
];

export default function BadgesPage() {
  return (
    <CrudPage<Badge>
      resource="badges"
      title="Badges"
      description="Conquistas do sistema. Badges próprias de parceiros aparecem com o parceiro indicado."
      fields={fields}
      columns={[
        {
          key: "name",
          label: "Badge",
          render: (r) => (
            <span className="flex items-center gap-2">
              {r.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.iconUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-900/40" aria-hidden />
              )}
              {r.name}
            </span>
          ),
        },
        { key: "key", label: "Chave", render: (r) => <code className="text-xs">{r.key}</code> },
        { key: "description", label: "Descrição" },
        { key: "partnerId", label: "Origem", render: (r) => (r.partnerId ? "Parceiro" : "Sistema") },
      ]}
    />
  );
}
