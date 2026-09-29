"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { getActivePartnerId } from "@/lib/api-client";
import type { ApiResponse } from "@tinypet/shared";

type ImportResult = { created: number; skipped: number; limitReached?: boolean; errors?: { row: number; message: string }[] };

export function ImportCsvModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const headers = new Headers();
      const pid = getActivePartnerId();
      if (pid) headers.set("X-Partner-Id", pid);
      const res = await fetch("/api/v1/clients/import", { method: "POST", body: fd, headers, credentials: "include" });
      const body = (await res.json().catch(() => null)) as ApiResponse<ImportResult> | null;
      if (!body) throw new Error("Resposta inválida do servidor");
      if (!body.ok) throw new Error(body.error.message);
      setResult(body.data);
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast(`${body.data.created} clientes importados`, "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na importação");
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (busy) return; // import in progress
    setFile(null);
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Importar clientes (CSV)">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-[var(--muted)]">
          Envie um arquivo CSV com cabeçalho e as colunas <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">name,email,phone,petName,species</code>. Espécie usa a chave (dog, cat, bird…). Linhas repetidas ou sem nome são ignoradas.
        </p>
        <div>
          <label htmlFor="csv-file" className="label">
            Arquivo CSV
          </label>
          <input id="csv-file" type="file" accept=".csv,text/csv" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {result && (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
            Importação concluída: <strong>{result.created}</strong> criados, <strong>{result.skipped}</strong> ignorados.
          </p>
        )}
        {result?.limitReached && (
          <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
            O limite de clientes do seu plano foi atingido; as linhas restantes não foram importadas. Faça upgrade para importar mais.
          </p>
        )}
        {!!result?.errors?.length && (
          <details className="text-sm">
            <summary className="cursor-pointer text-red-700 dark:text-red-300">{result.errors.length} linha(s) com erro</summary>
            <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5 text-xs text-[var(--muted)]">
              {result.errors.slice(0, 100).map((e, i) => (
                <li key={i}>
                  Linha {e.row}: {e.message}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result && (
            <Button type="submit" disabled={!file} loading={busy}>
              Importar
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
