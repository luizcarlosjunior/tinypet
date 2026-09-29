"use client";
import { useState, type ReactNode } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { Table, th, td } from "@/components/painel/ui";
import { cn } from "@/lib/utils";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "checkbox" | "select" | "json" | "textarea" | "url";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  /** Hidden from the create form (e.g. status set by action). */
  createOnly?: boolean;
  editOnly?: boolean;
  width?: string;
  /** What an empty input sends. Default: "omit" for numbers (schemas use `.optional()`), "null" otherwise. */
  emptyAs?: "null" | "omit";
  /** Current value for the inline edit form when it isn't `row[key]` (e.g. skills: `species.key`). */
  valueOf?: (row: Row) => unknown;
  /** Allow decimals in number inputs (default: integers, like the admin schemas). */
  decimal?: boolean;
};
export type Row = { id: string; [k: string]: unknown };
export type ColumnDef<T extends Row = Row> = { key: string; label: string; render?: (row: T) => ReactNode; className?: string };

/** Builds a payload from a FormData based on field defs (numbers coerced, checkboxes boolean, json parsed). */
export function payloadFromForm(fd: FormData, fields: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = fd.get(f.key);
    if (f.type === "checkbox") {
      out[f.key] = raw === "on";
      continue;
    }
    const v = typeof raw === "string" ? raw.trim() : "";
    if (v === "") {
      const emptyAs = f.emptyAs ?? (f.type === "number" ? "omit" : "null");
      if (f.required && f.type !== "number" && f.type !== "select") out[f.key] = "";
      else if (emptyAs === "null") out[f.key] = null;
      continue;
    }
    if (f.type === "number") out[f.key] = Number(v);
    else if (f.type === "json") out[f.key] = JSON.parse(v);
    else out[f.key] = v;
  }
  return out;
}

export function FieldInput({ f, defaultValue, idPrefix }: { f: FieldDef; defaultValue?: unknown; idPrefix: string }) {
  const id = `${idPrefix}-${f.key}`;
  if (f.type === "checkbox") {
    return (
      <label htmlFor={id} className="flex items-center gap-2 pt-5 text-sm">
        <input id={id} name={f.key} type="checkbox" defaultChecked={!!defaultValue} className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-400" />
        {f.label}
      </label>
    );
  }
  if (f.type === "select") {
    return (
      <div>
        <label htmlFor={id} className="label">
          {f.label}
        </label>
        <select id={id} name={f.key} defaultValue={defaultValue == null ? "" : String(defaultValue)} className="input" required={f.required}>
          <option value="">—</option>
          {(f.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (f.type === "json" || f.type === "textarea") {
    const dv = f.type === "json" ? (defaultValue === undefined ? "" : JSON.stringify(defaultValue, null, 2)) : defaultValue == null ? "" : String(defaultValue);
    return (
      <div className="sm:col-span-2">
        <label htmlFor={id} className="label">
          {f.label}
        </label>
        <textarea id={id} name={f.key} defaultValue={dv} className="input min-h-[80px] font-mono text-xs" placeholder={f.placeholder} required={f.required} spellCheck={false} />
      </div>
    );
  }
  return (
    <div>
      <label htmlFor={id} className="label">
        {f.label}
      </label>
      <input id={id} name={f.key} type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"} step={f.type === "number" ? (f.decimal ? "any" : 1) : undefined} defaultValue={defaultValue == null ? "" : String(defaultValue)} className="input" placeholder={f.placeholder} required={f.required} />
    </div>
  );
}

export function renderCell(v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-[var(--muted)]">—</span>;
  if (typeof v === "boolean") return v ? <Badge tone="green">Sim</Badge> : <Badge tone="gray">Não</Badge>;
  if (typeof v === "object") return <code className="text-xs">{JSON.stringify(v)}</code>;
  return String(v);
}

/**
 * Compact table with inline edit row. `fields` drive both the inline edit form and the payload.
 */
export function AdminTable<T extends Row>({ rows, columns, fields, onSave, onDelete, saving, extraActions, expand, emptyText = "Nenhum registro.", idPrefix = "row" }: { rows: T[]; columns: ColumnDef<T>[]; fields: FieldDef[]; onSave?: (id: string, body: Record<string, unknown>) => Promise<unknown> | void; onDelete?: (row: T) => void; saving?: boolean; extraActions?: (row: T) => ReactNode; expand?: (row: T) => ReactNode; emptyText?: string; idPrefix?: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const editFields = fields.filter((f) => !f.createOnly);
  const colSpan = columns.length + 1;
  return (
    <Table>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col" className={cn(th, c.className)}>
              {c.label}
            </th>
          ))}
          <th scope="col" className={cn(th, "text-right")}>
            Ações
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={colSpan} className={cn(td, "py-6 text-center text-[var(--muted)]")}>
              {emptyText}
            </td>
          </tr>
        )}
        {rows.map((r) => {
          const isEdit = editing === r.id;
          const isOpen = expanded === r.id;
          return (
            <FragmentRow key={r.id}>
              {isEdit ? (
                <tr className="bg-brand-50/40 dark:bg-brand-900/10">
                  <td colSpan={colSpan} className={td}>
                    <form
                      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setErr(null);
                        try {
                          const body = payloadFromForm(new FormData(e.currentTarget), editFields);
                          await onSave?.(r.id, body);
                          setEditing(null);
                        } catch (ex) {
                          setErr(ex instanceof Error ? ex.message : "JSON inválido");
                        }
                      }}
                    >
                      {editFields.map((f) => (
                        <FieldInput key={f.key} f={f} defaultValue={f.valueOf ? f.valueOf(r) : r[f.key]} idPrefix={`${idPrefix}-${r.id}`} />
                      ))}
                      {err && (
                        <p className="text-xs text-red-600 sm:col-span-2 lg:col-span-3" role="alert">
                          {err}
                        </p>
                      )}
                      <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-3">
                        <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                          <X className="h-4 w-4" aria-hidden /> Cancelar
                        </Button>
                        <Button type="submit" loading={saving}>
                          <Check className="h-4 w-4" aria-hidden /> Salvar
                        </Button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr className={cn(isOpen && "bg-ink-50 dark:bg-ink-900/40")}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn(td, c.className)}>
                      {c.render ? c.render(r) : renderCell(r[c.key])}
                    </td>
                  ))}
                  <td className={cn(td, "whitespace-nowrap text-right")}>
                    <div className="inline-flex items-center gap-1">
                      {extraActions?.(r)}
                      {expand && (
                        <button type="button" className="btn-ghost h-8 px-2 text-xs" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : r.id)}>
                          {isOpen ? "Recolher" : "Expandir"}
                        </button>
                      )}
                      {onSave && (
                        <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label="Editar" onClick={() => setEditing(r.id)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label="Remover" onClick={() => onDelete(r)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {expand && isOpen && !isEdit && (
                <tr>
                  <td colSpan={colSpan} className={cn(td, "bg-ink-50 p-3 dark:bg-ink-900/40")}>
                    {expand(r)}
                  </td>
                </tr>
              )}
            </FragmentRow>
          );
        })}
      </tbody>
    </Table>
  );
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Inline create form built from field defs. */
export function CreateForm({ fields, onSubmit, submitting, title = "Novo registro", idPrefix = "new", compact }: { fields: FieldDef[]; onSubmit: (body: Record<string, unknown>) => Promise<unknown> | void; submitting?: boolean; title?: string; idPrefix?: string; compact?: boolean }) {
  const [err, setErr] = useState<string | null>(null);
  const createFields = fields.filter((f) => !f.editOnly);
  return (
    <form
      className={cn("card", compact && "p-3")}
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        const form = e.currentTarget;
        try {
          const body = payloadFromForm(new FormData(form), createFields);
          await onSubmit(body);
          form.reset();
        } catch (ex) {
          setErr(ex instanceof Error ? ex.message : "Dados inválidos");
        }
      }}
    >
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {createFields.map((f) => (
          <FieldInput key={f.key} f={f} idPrefix={idPrefix} />
        ))}
        <div className="flex items-end">
          <Button type="submit" loading={submitting}>
            Adicionar
          </Button>
        </div>
      </div>
      {err && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {err}
        </p>
      )}
    </form>
  );
}
