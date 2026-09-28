"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { Button, Input, PageHeader } from "@/components/ui";
import { ConfirmDialog, QueryState, Table, td, th } from "@/components/painel/ui";
import { useToast } from "@/components/ui/toast";
import { useAdminList } from "@/hooks/use-admin";
import { cn } from "@/lib/utils";

type Setting = { id?: string; key: string; value: unknown; updatedAt?: string };

function pretty(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default function ConfiguracoesPage() {
  const list = useAdminList<Setting & { id: string }>("settings");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [del, setDel] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "settings"] });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api(`/admin/settings/${encodeURIComponent(key)}`, { method: "PATCH", json: { value }, partnerId: null }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast("Configuração salva", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const create = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api(`/admin/settings`, { method: "POST", json: { key, value }, partnerId: null }),
    onSuccess: () => {
      invalidate();
      setNewKey("");
      setNewVal("");
      toast("Configuração criada", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const remove = useMutation({
    mutationFn: (key: string) => api(`/admin/settings/${encodeURIComponent(key)}`, { method: "DELETE", partnerId: null }),
    onSuccess: () => {
      invalidate();
      setDel(null);
      toast("Removida", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const parse = (s: string): unknown => {
    const t = s.trim();
    if (t === "") throw new Error("Informe um valor JSON (ex.: \"texto\", 10, true ou {\"a\":1})");
    return JSON.parse(t);
  };

  const rows = (list.data?.items ?? []).map((r) => ({ ...r, key: r.key ?? r.id }));

  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" description="Chaves e valores (JSON) usados pela plataforma, como lembretes, folga de rota e textos padrão." />
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          try {
            create.mutate({ key: newKey.trim(), value: parse(newVal) });
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : "JSON inválido");
          }
        }}
      >
        <h2 className="mb-3 text-sm font-semibold">Nova configuração</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input id="cfg-key" label="Chave" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="reminders.hoursBefore" required />
          <div className="sm:col-span-2">
            <label htmlFor="cfg-value" className="label">
              Valor (JSON)
            </label>
            <textarea id="cfg-value" className="input min-h-[60px] font-mono text-xs" value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder='[24, 2]' spellCheck={false} required />
          </div>
        </div>
        {err && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {err}
          </p>
        )}
        <div className="mt-3 flex justify-end">
          <Button type="submit" loading={create.isPending}>
            Adicionar
          </Button>
        </div>
      </form>

      <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()}>
        <Table>
          <thead>
            <tr>
              <th className={cn(th, "w-64")}>Chave</th>
              <th className={th}>Valor</th>
              <th className={cn(th, "text-right")}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className={cn(td, "py-6 text-center text-[var(--muted)]")}>
                  Nenhuma configuração.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="align-top">
                <td className={td}>
                  <code className="text-xs">{r.key}</code>
                </td>
                <td className={td}>
                  {editing === r.key ? (
                    <div>
                      <textarea aria-label={`Valor de ${r.key}`} className="input min-h-[90px] font-mono text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
                      {err && (
                        <p className="mt-1 text-xs text-red-600" role="alert">
                          {err}
                        </p>
                      )}
                    </div>
                  ) : (
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">{pretty(r.value)}</pre>
                  )}
                </td>
                <td className={cn(td, "whitespace-nowrap text-right")}>
                  {editing === r.key ? (
                    <div className="inline-flex gap-1">
                      <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => setEditing(null)}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        className="h-8 px-2 text-xs"
                        loading={save.isPending}
                        onClick={() => {
                          setErr(null);
                          try {
                            save.mutate({ key: r.key, value: parse(draft) });
                          } catch (ex) {
                            setErr(ex instanceof Error ? ex.message : "JSON inválido");
                          }
                        }}
                      >
                        Salvar
                      </Button>
                    </div>
                  ) : (
                    <div className="inline-flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => {
                          setErr(null);
                          setEditing(r.key);
                          setDraft(pretty(r.value));
                        }}
                      >
                        Editar
                      </Button>
                      <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-red-600" onClick={() => setDel(r.key)}>
                        Remover
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </QueryState>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title={`Remover "${del}"?`} confirmLabel="Remover" danger loading={remove.isPending} onConfirm={() => del && remove.mutate(del)} />
    </div>
  );
}
