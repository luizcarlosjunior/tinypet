"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, MessageCircle, Plus, Upload, Link2 } from "lucide-react";
import { Badge, Button, Empty, PageHeader } from "@/components/ui";
import { Pagination, QueryState, SearchInput, Table, td, th } from "@/components/painel/ui";
import { useActivePartner } from "@/hooks/use-partner";
import { useSpecies } from "@/hooks/use-ref";
import { useClients } from "@/hooks/use-crm";
import { fmtPhone, whatsappLink, MONTHS } from "@/lib/format";
import { petNames } from "@/components/forms/ClientSearch";
import { ImportCsvModal } from "@/components/painel/clientes/ImportCsvModal";
import { BirthdaysPanel } from "@/components/painel/clientes/BirthdaysPanel";

export default function ClientesPage() {
  const { partnerId } = useActivePartner();
  const species = useSpecies();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tag, setTag] = useState("");
  const [sp, setSp] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const pageSize = 20;
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [debounced, tag, sp, month]);

  const list = useClients({ q: debounced || undefined, tag: tag || undefined, species: sp || undefined, birthdayMonth: month ? Number(month) : undefined, page, pageSize }, partnerId);
  const items = list.data?.data ?? [];
  const total = list.data?.meta?.total ?? items.length;

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Sua carteira de clientes e pets."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" aria-hidden /> Importar CSV
            </Button>
            <a href={`/api/v1/clients/export${partnerId ? `?partnerId=${partnerId}` : ""}`} target="_blank" rel="noreferrer" className="btn-secondary">
              <Download className="h-4 w-4" aria-hidden /> Exportar
            </a>
            <Link href="/painel/clientes/novo" className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden /> Novo cliente
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <SearchInput value={q} onChange={setQ} placeholder="Nome, telefone ou pet…" />
            <input aria-label="Etiqueta" className="input sm:w-36" placeholder="Etiqueta" value={tag} onChange={(e) => setTag(e.target.value)} />
            <select aria-label="Espécie" className="input sm:w-40" value={sp} onChange={(e) => setSp(e.target.value)}>
              <option value="">Todas as espécies</option>
              {(species.data ?? []).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select aria-label="Mês de aniversário" className="input sm:w-44" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Aniversário (todos)</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <QueryState
            isLoading={list.isLoading}
            error={list.error}
            retry={() => list.refetch()}
            isEmpty={items.length === 0}
            empty={<Empty title="Nenhum cliente encontrado" description={debounced || tag || sp || month ? "Ajuste os filtros ou cadastre um novo cliente." : "Cadastre seu primeiro cliente ou importe uma planilha."} action={<Link href="/painel/clientes/novo" className="btn-primary">Novo cliente</Link>} />}
          >
            <Table>
              <thead>
                <tr>
                  <th className={th}>Cliente</th>
                  <th className={th}>Telefone</th>
                  <th className={`${th} hidden md:table-cell`}>Pets</th>
                  <th className={`${th} hidden sm:table-cell`}>Etiquetas</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/40">
                    <td className={td}>
                      <Link href={`/painel/clientes/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.userId && (
                        <Badge tone="green" className="ml-2">
                          <Link2 className="mr-1 h-3 w-3" aria-hidden /> Vinculado
                        </Badge>
                      )}
                    </td>
                    <td className={td}>
                      {c.primaryPhone ? (
                        <span className="inline-flex items-center gap-1">
                          {fmtPhone(c.primaryPhone)}
                          <a href={whatsappLink(c.primaryPhone)} target="_blank" rel="noreferrer" className="text-emerald-600" aria-label={`WhatsApp de ${c.name}`}>
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className={`${td} hidden md:table-cell`}>{petNames(c) || <span className="text-[var(--muted)]">—</span>}</td>
                    <td className={`${td} hidden sm:table-cell`}>
                      <span className="flex flex-wrap gap-1">
                        {(c.tags ?? []).map((t) => (
                          <Badge key={t}>{t}</Badge>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />
          </QueryState>
        </div>
        <BirthdaysPanel partnerId={partnerId} />
      </div>
      <ImportCsvModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
