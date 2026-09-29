"use client";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { Tabs } from "@/components/painel/ui";
import { CrudPage } from "@/components/admin/CrudPage";
import { NestedCrud } from "@/components/admin/NestedCrud";
import { useAdminMutations } from "@/hooks/use-admin";
import type { FieldDef, Row } from "@/components/admin/AdminTable";

type Brand = Row & { name: string; status?: "PENDING" | "APPROVED" | "REJECTED"; lines?: Row[] };
const STATUS_OPTS = [
  { value: "APPROVED", label: "Aprovada" },
  { value: "PENDING", label: "Pendente" },
  { value: "REJECTED", label: "Rejeitada" },
];
const fields: FieldDef[] = [
  { key: "name", label: "Marca", required: true },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTS, emptyAs: "omit" },
];
const lineFields: FieldDef[] = [{ key: "name", label: "Linha", required: true }];

function StatusBadge({ s }: { s?: string }) {
  if (s === "PENDING") return <Badge tone="amber">Pendente</Badge>;
  if (s === "REJECTED") return <Badge tone="red">Rejeitada</Badge>;
  return <Badge tone="green">Aprovada</Badge>;
}

export default function MarcasPage() {
  const [tab, setTab] = useState<"all" | "pending">("all");
  const m = useAdminMutations("brands");
  // approving goes through POST /admin/brands/:id/approve (also approves the brand's pending product lines)
  const approve = (id: string, status: "APPROVED" | "REJECTED") => (status === "APPROVED" ? m.post.mutate({ path: `${id}/approve` }) : m.update.mutate({ id, body: { status } }));
  return (
    <CrudPage<Brand>
      resource="brands"
      title="Marcas e linhas"
      description="Marcas de produtos (ração, acessórios). Sugestões de tutores entram como pendentes até a aprovação."
      fields={fields}
      params={tab === "pending" ? { status: "PENDING" } : undefined}
      header={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: "all", label: "Todas" },
            { key: "pending", label: "Pendentes" },
          ]}
        />
      }
      columns={[
        { key: "name", label: "Marca" },
        { key: "status", label: "Status", render: (r) => <StatusBadge s={r.status} /> },
        { key: "lines", label: "Linhas", render: (r) => (Array.isArray(r.lines) ? r.lines.length : "—") },
      ]}
      sort={(a, b) => (a.status === "PENDING" ? -1 : 0) - (b.status === "PENDING" ? -1 : 0) || String(a.name).localeCompare(String(b.name))}
      extraActions={(r) =>
        r.status === "PENDING" ? (
          <>
            <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => approve(r.id, "APPROVED")} loading={m.update.isPending}>
              Aprovar
            </Button>
            <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-red-600" onClick={() => approve(r.id, "REJECTED")}>
              Rejeitar
            </Button>
          </>
        ) : null
      }
      expand={(r) => (
        <NestedCrud
          resource="product-lines"
          parentResource="brands"
          parentKey="brandId"
          parentId={r.id}
          title={`Nova linha de ${r.name}`}
          fields={lineFields}
          columns={[
            { key: "name", label: "Linha" },
            { key: "status", label: "Status", render: (l) => <StatusBadge s={l.status as string} /> },
          ]}
        />
      )}
    />
  );
}
