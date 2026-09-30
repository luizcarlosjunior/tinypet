"use client";
import { useState } from "react";
import { QueryState, ConfirmDialog } from "@/components/painel/ui";
import { useAdminList, useAdminMutations } from "@/hooks/use-admin";
import { AdminTable, CreateForm, type ColumnDef, type FieldDef, type Row } from "./AdminTable";

/** Child CRUD rendered inside an expanded parent row (e.g. subcategories of a category). */
export function NestedCrud<T extends Row = Row>({ resource, parentKey, parentId, columns, fields, title, filterLocal, parentResource, expand }: { resource: string; parentKey: string; parentId: string; columns: ColumnDef<T>[]; fields: FieldDef[]; title: string; filterLocal?: boolean; parentResource?: string; expand?: (row: T) => React.ReactNode }) {
  const list = useAdminList<T>(resource, filterLocal ? undefined : { [parentKey]: parentId });
  const m = useAdminMutations(resource, { invalidate: parentResource ? [parentResource] : [] });
  const [del, setDel] = useState<T | null>(null);
  const rows = (list.data?.items ?? []).filter((r) => !filterLocal || r[parentKey] === parentId);
  return (
    <div className="space-y-3">
      <CreateForm compact fields={fields} title={title} idPrefix={`new-${resource}-${parentId}`} submitting={m.create.isPending} onSubmit={(b) => m.create.mutateAsync({ ...b, [parentKey]: parentId })} />
      <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()}>
        <AdminTable<T> rows={rows} columns={columns} fields={fields} idPrefix={`${resource}-${parentId}`} saving={m.update.isPending} onSave={(id, body) => m.update.mutateAsync({ id, body: { ...body, [parentKey]: parentId } })} onDelete={(r) => setDel(r)} expand={expand} />
      </QueryState>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Remover?" confirmLabel="Remover" danger loading={m.remove.isPending} onConfirm={() => del && m.remove.mutate(del.id, { onSuccess: () => setDel(null) })} />
    </div>
  );
}
