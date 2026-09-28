"use client";
import { useState } from "react";
import { Badge, Button, Empty, PageHeader } from "@/components/ui";
import { QueryState, Tabs, Table, td, th } from "@/components/painel/ui";
import { useAdminFlaggedMedia, useAdminReports, useModerate, type AdminReport } from "@/hooks/use-admin";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "reports" | "media";
type RStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export default function ModeracaoPage() {
  const [tab, setTab] = useState<Tab>("reports");
  return (
    <div className="space-y-4">
      <PageHeader title="Moderação" description="Denúncias de avaliações e mídia sinalizada pela moderação automática." />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "reports", label: "Denúncias" },
          { key: "media", label: "Mídia sinalizada" },
        ]}
      />
      {tab === "reports" ? <Reports /> : <FlaggedMedia />}
    </div>
  );
}

function ReportStatus({ s }: { s: RStatus }) {
  if (s === "OPEN") return <Badge tone="amber">Aberta</Badge>;
  if (s === "RESOLVED") return <Badge tone="green">Resolvida</Badge>;
  return <Badge tone="gray">Descartada</Badge>;
}

function Reports() {
  const [status, setStatus] = useState<RStatus>("OPEN");
  const list = useAdminReports(status);
  const { report } = useModerate();
  const rows = list.data?.items ?? [];
  const act = (r: AdminReport, action: "HIDE" | "RESTORE" | "DISMISS") => report.mutate({ id: r.id, action });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="rep-status" className="text-sm text-[var(--muted)]">
          Status
        </label>
        <select id="rep-status" className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as RStatus)}>
          <option value="OPEN">Abertas</option>
          <option value="RESOLVED">Resolvidas</option>
          <option value="DISMISSED">Descartadas</option>
        </select>
      </div>
      <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()} isEmpty={rows.length === 0} empty={<Empty title="Nenhuma denúncia" description="Nada para moderar com este status." />}>
        <Table>
          <thead>
            <tr>
              <th className={th}>Motivo</th>
              <th className={th}>Conteúdo</th>
              <th className={th}>Denunciante</th>
              <th className={th}>Data</th>
              <th className={th}>Status</th>
              <th className={cn(th, "text-right")}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className={cn(td, "max-w-xs")}>{r.reason}</td>
                <td className={cn(td, "max-w-sm")}>
                  {r.review ? (
                    <div className="text-xs">
                      <span className="font-medium">Avaliação {r.review.rating != null ? `${r.review.rating}/5` : ""}</span>
                      {r.review.user?.name && <span className="text-[var(--muted)]"> · {r.review.user.name}</span>}
                      {r.review.status && (
                        <Badge tone={r.review.status === "HIDDEN" ? "red" : "gray"} className="ml-1">
                          {r.review.status === "HIDDEN" ? "Oculta" : r.review.status === "VISIBLE" ? "Visível" : r.review.status}
                        </Badge>
                      )}
                      {r.review.comment && <p className="mt-1 line-clamp-3 text-[var(--fg)]">“{r.review.comment}”</p>}
                    </div>
                  ) : r.mediaAsset ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.mediaAsset.thumbUrl || r.mediaAsset.url} alt="Mídia denunciada" className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <span className="text-xs text-[var(--muted)]">{r.mediaAssetId ? `Mídia ${r.mediaAssetId}` : "—"}</span>
                  )}
                </td>
                <td className={td}>
                  {r.reporter?.name ?? "—"}
                  {r.reporter?.email && <span className="block text-xs text-[var(--muted)]">{r.reporter.email}</span>}
                </td>
                <td className={cn(td, "whitespace-nowrap")}>{fmtDateTime(r.createdAt)}</td>
                <td className={td}>
                  <ReportStatus s={r.status} />
                </td>
                <td className={cn(td, "whitespace-nowrap text-right")}>
                  <div className="inline-flex gap-1">
                    <Button type="button" variant="danger" className="h-8 px-2 text-xs" onClick={() => act(r, "HIDE")} loading={report.isPending}>
                      Ocultar
                    </Button>
                    <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => act(r, "RESTORE")}>
                      Restaurar
                    </Button>
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => act(r, "DISMISS")}>
                      Descartar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </QueryState>
    </div>
  );
}

function FlaggedMedia() {
  const list = useAdminFlaggedMedia();
  const { media } = useModerate();
  const rows = list.data?.items ?? [];
  return (
    <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()} isEmpty={rows.length === 0} empty={<Empty title="Nenhuma mídia sinalizada" description="A moderação automática não sinalizou nada pendente." />}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Mídias sinalizadas">
        {rows.map((m) => (
          <li key={m.id} className="overflow-hidden rounded-xl border bg-[var(--card)]">
            <div className="aspect-square bg-ink-100 dark:bg-ink-900">
              {m.kind === "VIDEO" ? (
                <video src={m.url} controls muted className="h-full w-full object-cover" aria-label="Vídeo sinalizado" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbUrl || m.url} alt="Mídia sinalizada" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="space-y-1 p-2 text-xs">
              <p className="truncate text-[var(--muted)]">
                {m.purpose} · {m.partner?.tradeName ?? m.user?.name ?? "—"}
              </p>
              {m.createdAt && <p className="text-[var(--muted)]">{fmtDateTime(m.createdAt)}</p>}
              <div className="flex gap-1 pt-1">
                <Button type="button" className="h-8 flex-1 px-2 text-xs" onClick={() => media.mutate({ id: m.id, action: "APPROVE" })} loading={media.isPending}>
                  Aprovar
                </Button>
                <Button type="button" variant="danger" className="h-8 flex-1 px-2 text-xs" onClick={() => media.mutate({ id: m.id, action: "REJECT" })}>
                  Rejeitar
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </QueryState>
  );
}
