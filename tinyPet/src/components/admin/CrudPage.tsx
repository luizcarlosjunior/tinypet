"use client";
import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { QueryState, ConfirmDialog } from "@/components/painel/ui";
import { useAdminList, useAdminMutations } from "@/hooks/use-admin";
import { AdminTable, CreateForm, type ColumnDef, type FieldDef, type Row } from "./AdminTable";

/**
 * Generic CRUD over `/admin/<resource>`: list + create form + inline edit + delete.
 */
export function CrudPage<T extends Row = Row>({ resource, title, description, columns, fields, params, createTitle, extraActions, expand, header, transformCreate, transformUpdate, sort }: { resource: string; title: string; description?: string; columns: ColumnDef<T>[]; fields: FieldDef[]; params?: Record<string, string | number | boolean | undefined | null>; createTitle?: string; extraActions?: (row: T) => ReactNode; expand?: (row: T) => ReactNode; header?: ReactNode; transformCreate?: (b: Record<string, unknown>) => Record<string, unknown>; transformUpdate?: (b: Record<string, unknown>, row: T) => Record<string, unknown>; sort?: (a: T, b: T) => number }) {
  const list = useAdminList<T>(resource, params);
  const m = useAdminMutations(resource);
  const [del, setDel] = useState<T | null>(null);
  const rows = sort ? [...(list.data?.items ?? [])].sort(sort) : list.data?.items ?? [];
  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} />
      {header}
      <CreateForm fields={fields} title={createTitle ?? `Novo: ${title}`} submitting={m.create.isPending} idPrefix={`new-${resource}`} onSubmit={(b) => m.create.mutateAsync(transformCreate ? transformCreate(b) : b)} />
      <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()}>
        <AdminTable<T>
          rows={rows}
          columns={columns}
          fields={fields}
          saving={m.update.isPending}
          idPrefix={resource}
          onSave={(id, body) => {
            const row = rows.find((r) => r.id === id)!;
            return m.update.mutateAsync({ id, body: transformUpdate ? transformUpdate(body, row) : body });
          }}
          onDelete={(r) => setDel(r)}
          extraActions={extraActions}
          expand={expand}
        />
      </QueryState>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Remover registro?" description="Esta ação não pode ser desfeita e pode afetar dados vinculados." confirmLabel="Remover" danger loading={m.remove.isPending} onConfirm={() => del && m.remove.mutate(del.id, { onSuccess: () => setDel(null) })} />
    </div>
  );
}
