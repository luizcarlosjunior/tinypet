"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Image as ImageIcon, ShieldAlert, Video } from "lucide-react";
import { SANCTION_DURATIONS, safeHref, type SanctionDuration } from "@tinypet/shared";
import { Badge, Button, Empty, PageHeader, Textarea } from "@/components/ui";
import { Checkbox, Drawer, Pagination, QueryState, Tabs, Table, td, th } from "@/components/painel/ui";
import { useAdminList } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; email: string; username: string | null; lastIp: string | null; suspendedUntil: string | null };
type Sanction = { id: string; kind: "ACCOUNT_SUSPENSION" | "IP_BLOCK" | "REPORT_BAN"; ip: string | null; reason: string; startsAt: string; endsAt: string | null; revokedAt: string | null; createdAt: string; active: boolean };
type QueueItem = {
  asset: { id: string; url: string; thumbUrl: string | null; kind: "IMAGE" | "VIDEO" | "DOCUMENT"; purpose: string; status: string; createdAt: string; uploadIp: string | null };
  uploader: Person | null;
  partner: { id: string; tradeName: string; slug: string } | null;
  reportsCount: number;
  lastReportAt: string;
  reasons: { reason: string; label: string; count: number }[];
};
type Detail = {
  asset: QueueItem["asset"] & { mimeType: string; width: number | null; height: number | null; sizeBytes: number };
  uploader: (Person & { sanctions: Sanction[] }) | null;
  partner: QueueItem["partner"];
  usages: { type: string; id: string; label: string; href?: string }[];
  reports: { id: string; reason: string; reasonLabel: string; details: string | null; status: "OPEN" | "RESOLVED" | "DISMISSED"; createdAt: string; reporterIp: string | null; reporter: Person & { stats: { total: number; resolved: number; dismissed: number }; sanctions: Sanction[] } }[];
};
type SanctionRow = Sanction & { user: { id: string; name: string; email: string; username: string | null }; createdBy: { name: string }; revokedBy: { name: string } | null };

type Tab = "open" | "history" | "sanctions";
const PURPOSE: Record<string, string> = { PET_GALLERY: "Galeria de pet", VENUE_PHOTO: "Foto do local", CATALOG: "Catálogo", COURSE: "Curso", PARTNER_LOGO: "Logo", USER_AVATAR: "Avatar", PET_AVATAR: "Avatar de pet", VIDEO_COVER: "Capa de vídeo", ATTACHMENT: "Anexo", RECEIPT: "Comprovante" };
const KIND_LABEL: Record<Sanction["kind"], string> = { ACCOUNT_SUSPENSION: "Conta suspensa", IP_BLOCK: "IP bloqueado", REPORT_BAN: "Sem denúncias" };
const durLabel = (d: SanctionDuration) => (d === "PERMANENT" ? "Para sempre" : `${d} dias`);
const until = (s: { endsAt: string | null }) => (s.endsAt ? `até ${fmtDateTime(s.endsAt)}` : "permanente");

export default function AuditoriaPage() {
  const [tab, setTab] = useState<Tab>("open");
  return (
    <div className="space-y-4">
      <PageHeader title="Auditoria de mídia" description="Fotos e vídeos denunciados por tutores. Exclua o conteúdo impróprio (exclusão real, em todos os lugares) e aplique sanções a quem enviou — ou descarte e puna denúncias caluniosas." />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "open", label: "Denúncias abertas" },
          { key: "history", label: "Histórico" },
          { key: "sanctions", label: "Sanções" },
        ]}
      />
      {tab === "open" && <Queue status="OPEN" />}
      {tab === "history" && <History />}
      {tab === "sanctions" && <Sanctions />}
    </div>
  );
}

function Thumb({ a, className }: { a: { url: string; thumbUrl: string | null; kind: string }; className?: string }) {
  return a.kind === "VIDEO" ? (
    <video src={safeHref(a.url)} poster={a.thumbUrl ? safeHref(a.thumbUrl) : undefined} muted preload="metadata" className={cn("h-full w-full object-cover", className)} aria-label="Vídeo denunciado" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={safeHref(a.thumbUrl || a.url)} alt="Mídia denunciada" className={cn("h-full w-full object-cover", className)} />
  );
}

function History() {
  const [status, setStatus] = useState<"RESOLVED" | "DISMISSED">("RESOLVED");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor="hist-status" className="text-sm text-[var(--muted)]">
          Mostrar
        </label>
        <select id="hist-status" className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="RESOLVED">Denúncias procedentes (mídia excluída)</option>
          <option value="DISMISSED">Denúncias descartadas</option>
        </select>
      </div>
      <p className="text-xs text-[var(--muted)]">Mídias excluídas não aparecem mais aqui (foram apagadas); o registro fica nas denúncias e nas sanções.</p>
      <Queue status={status} />
    </div>
  );
}

function Queue({ status }: { status: "OPEN" | "RESOLVED" | "DISMISSED" }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useAdminList<QueueItem>("media-audit", { status, page, pageSize: 24 });
  const rows = list.data?.items ?? [];
  return (
    <>
      <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()} isEmpty={rows.length === 0} empty={<Empty title={status === "OPEN" ? "Nenhuma denúncia aberta" : "Nada por aqui"} description={status === "OPEN" ? "Quando um tutor denunciar uma foto ou vídeo, ela aparece aqui." : undefined} />}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Mídias denunciadas">
          {rows.map((it) => (
            <li key={it.asset.id}>
              <button type="button" onClick={() => setSelected(it.asset.id)} className="block w-full overflow-hidden rounded-xl border bg-[var(--card)] text-left hover:border-brand-400">
                <div className="relative aspect-square bg-ink-100 dark:bg-ink-900">
                  <Thumb a={it.asset} />
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 p-1 text-white">{it.asset.kind === "VIDEO" ? <Video className="h-3.5 w-3.5" aria-label="Vídeo" /> : <ImageIcon className="h-3.5 w-3.5" aria-label="Foto" />}</span>
                  <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {it.reportsCount} {it.reportsCount === 1 ? "denúncia" : "denúncias"}
                  </span>
                </div>
                <div className="space-y-1 p-2 text-xs">
                  <p className="truncate font-medium">{it.reasons.map((r) => `${r.label}${r.count > 1 ? ` (${r.count})` : ""}`).join(", ")}</p>
                  <p className="truncate text-[var(--muted)]">
                    {PURPOSE[it.asset.purpose] ?? it.asset.purpose} · {it.partner?.tradeName ?? it.uploader?.name ?? "—"}
                  </p>
                  <p className="text-[var(--muted)]">Última: {fmtDateTime(it.lastReportAt)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
        {list.data?.meta && <Pagination page={page} pageSize={list.data.meta.pageSize} total={list.data.meta.total} onChange={setPage} />}
      </QueryState>
      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Análise da mídia" wide>
        {selected && <AuditDetail assetId={selected} onDone={() => setSelected(null)} />}
      </Drawer>
    </>
  );
}

function SanctionBadges({ list }: { list: Sanction[] }) {
  const active = list.filter((s) => s.active);
  if (!active.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1">
      {active.map((s) => (
        <Badge key={s.id} tone="red">
          {KIND_LABEL[s.kind]} {until(s)}
        </Badge>
      ))}
    </span>
  );
}

function DurationSelect({ value, onChange, id, allowNone = true }: { value: SanctionDuration | null; onChange: (v: SanctionDuration | null) => void; id: string; allowNone?: boolean }) {
  return (
    <select id={id} className="input w-auto" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "PERMANENT" ? "PERMANENT" : (Number(e.target.value) as SanctionDuration))}>
      {allowNone && <option value="">Não bloquear</option>}
      {SANCTION_DURATIONS.map((d) => (
        <option key={d} value={d}>
          {durLabel(d)}
        </option>
      ))}
    </select>
  );
}

function AuditDetail({ assetId, onDone }: { assetId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({ queryKey: ["admin", "media-audit", assetId], queryFn: () => api<Detail>(`/admin/media-audit/${assetId}`, { partnerId: null }) });
  const [reason, setReason] = useState("");
  const [blockIp, setBlockIp] = useState(false);
  const [account, setAccount] = useState<SanctionDuration | null>(null);
  const [reporters, setReporters] = useState<Record<string, { type: "ACCOUNT" | "REPORTS"; duration: SanctionDuration } | undefined>>({});
  const [confirm, setConfirm] = useState<"DELETE" | "DISMISS" | null>(null);

  const decide = useMutation({
    mutationFn: (action: "DELETE" | "DISMISS") =>
      api(`/admin/media-audit/${assetId}`, {
        method: "POST",
        partnerId: null,
        json:
          action === "DELETE"
            ? { action, reason: reason.trim(), uploader: { blockIp, account } }
            : { action, reason: reason.trim(), reporters: Object.entries(reporters).flatMap(([userId, v]) => (v ? [{ userId, ...v }] : [])) },
      }),
    onSuccess: (_d, action) => {
      qc.invalidateQueries({ queryKey: ["admin", "media-audit"] });
      qc.invalidateQueries({ queryKey: ["admin", "sanctions"] });
      toast(action === "DELETE" ? "Mídia excluída e sanções aplicadas." : "Denúncias descartadas.", "success");
      onDone();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  if (q.isLoading || q.error || !q.data) return <QueryState isLoading={q.isLoading} error={q.error ?? (q.data ? undefined : new Error("Mídia não encontrada"))} retry={() => q.refetch()}>{null}</QueryState>;
  const d = q.data;
  const open = d.reports.filter((r) => r.status === "OPEN");
  const openReporters = [...new Map(open.map((r) => [r.reporter.id, r.reporter])).values()];
  const ip = d.asset.uploadIp ?? d.uploader?.lastIp ?? null;
  const reasonOk = reason.trim().length >= 5;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-900">
        {d.asset.kind === "VIDEO" ? (
          <video src={safeHref(d.asset.url)} poster={d.asset.thumbUrl ? safeHref(d.asset.thumbUrl) : undefined} controls className="max-h-[60vh] w-full object-contain" aria-label="Vídeo denunciado" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeHref(d.asset.url)} alt="Mídia denunciada" className="max-h-[60vh] w-full object-contain" />
        )}
      </div>

      <section className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase text-[var(--muted)]">Enviado por</h3>
          {d.uploader ? (
            <p>
              {d.uploader.name} {d.uploader.username && <span className="text-[var(--muted)]">@{d.uploader.username}</span>}
              <span className="block text-xs text-[var(--muted)]">{d.uploader.email}</span>
              <SanctionBadges list={d.uploader.sanctions} />
            </p>
          ) : (
            <p className="text-[var(--muted)]">Usuário desconhecido</p>
          )}
          {d.partner && <p className="text-xs">Parceiro: {d.partner.tradeName}</p>}
          <p className="text-xs text-[var(--muted)]">IP do envio: {d.asset.uploadIp ?? "não registrado"}{!d.asset.uploadIp && d.uploader?.lastIp ? ` · último IP da conta: ${d.uploader.lastIp}` : ""}</p>
          <p className="text-xs text-[var(--muted)]">Enviado em {fmtDateTime(d.asset.createdAt)} · {PURPOSE[d.asset.purpose] ?? d.asset.purpose}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase text-[var(--muted)]">Onde aparece ({d.usages.length})</h3>
          {d.usages.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Não está em uso (só o arquivo).</p>
          ) : (
            <ul className="space-y-0.5 text-xs">
              {d.usages.map((u) => (
                <li key={`${u.type}-${u.id}`}>
                  {u.href ? (
                    <a href={u.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
                      {u.label} <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : (
                    u.label
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">Denúncias ({d.reports.length})</h3>
        <Table>
          <thead>
            <tr>
              <th className={th}>Motivo</th>
              <th className={th}>Denunciante</th>
              <th className={th}>Histórico</th>
              <th className={th}>Data</th>
            </tr>
          </thead>
          <tbody>
            {d.reports.map((r) => (
              <tr key={r.id} className="align-top">
                <td className={td}>
                  <span className="font-medium">{r.reasonLabel}</span>
                  {r.details && <p className="mt-0.5 text-xs text-[var(--muted)]">“{r.details}”</p>}
                  {r.status !== "OPEN" && <Badge tone="gray" className="mt-1">{r.status === "RESOLVED" ? "Procedente" : "Descartada"}</Badge>}
                </td>
                <td className={td}>
                  {r.reporter.name}
                  <span className="block text-xs text-[var(--muted)]">{r.reporter.email}</span>
                  <SanctionBadges list={r.reporter.sanctions} />
                </td>
                <td className={cn(td, "text-xs")}>
                  {r.reporter.stats.total} {r.reporter.stats.total === 1 ? "denúncia" : "denúncias"} · {r.reporter.stats.resolved} {r.reporter.stats.resolved === 1 ? "procedente" : "procedentes"} · <span className={r.reporter.stats.dismissed > r.reporter.stats.resolved ? "font-semibold text-red-600" : ""}>{r.reporter.stats.dismissed} {r.reporter.stats.dismissed === 1 ? "descartada" : "descartadas"}</span>
                </td>
                <td className={cn(td, "whitespace-nowrap text-xs")}>{fmtDateTime(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      {open.length > 0 && (
        <section className="space-y-4 rounded-xl border p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" aria-hidden /> Decisão
          </h3>
          <Textarea label="Motivo da decisão * (fica registrado e é enviado ao usuário)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={2} />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-red-200 p-3 dark:border-red-900/60">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Conteúdo impróprio: excluir</p>
              <p className="text-xs text-[var(--muted)]">Apaga o arquivo do storage e remove a mídia de todos os lugares listados acima. Não pode ser desfeito.</p>
              {d.uploader ? (
                <>
                  <Checkbox label={`Bloquear o IP por 7 dias${ip ? ` (${ip})` : ""}`} description={ip ? "Nenhuma requisição desse IP será aceita. IPs de operadora podem ser compartilhados." : "IP desconhecido: o bloqueio de IP não está disponível."} checked={blockIp} disabled={!ip} onChange={(e) => setBlockIp(e.target.checked)} />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <label htmlFor="acc-dur">Bloquear a conta de quem enviou:</label>
                    <DurationSelect id="acc-dur" value={account} onChange={setAccount} />
                  </div>
                </>
              ) : (
                <p className="text-xs text-[var(--muted)]">Sem usuário associado: não há a quem aplicar sanção.</p>
              )}
              <Button type="button" variant="danger" disabled={!reasonOk} loading={decide.isPending && confirm === "DELETE"} onClick={() => setConfirm("DELETE")}>
                Excluir mídia{blockIp || account ? " e aplicar sanções" : ""}
              </Button>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-semibold">Conteúdo adequado: descartar denúncias</p>
              <p className="text-xs text-[var(--muted)]">A mídia continua publicada. Se a denúncia foi caluniosa, puna quem denunciou:</p>
              <ul className="space-y-2">
                {openReporters.map((p) => {
                  const v = reporters[p.id];
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-[8rem] flex-1 truncate">{p.name}</span>
                      <select aria-label={`Sanção para ${p.name}`} className="input w-auto" value={v?.type ?? ""} onChange={(e) => setReporters((s) => ({ ...s, [p.id]: e.target.value ? { type: e.target.value as "ACCOUNT" | "REPORTS", duration: v?.duration ?? 7 } : undefined }))}>
                        <option value="">Sem sanção</option>
                        <option value="REPORTS">Impedir de denunciar</option>
                        <option value="ACCOUNT">Bloquear a conta</option>
                      </select>
                      {v && <DurationSelect id={`dur-${p.id}`} value={v.duration} allowNone={false} onChange={(dur) => setReporters((s) => ({ ...s, [p.id]: { ...v, duration: dur ?? 7 } }))} />}
                    </li>
                  );
                })}
              </ul>
              <Button type="button" variant="secondary" disabled={!reasonOk} loading={decide.isPending && confirm === "DISMISS"} onClick={() => setConfirm("DISMISS")}>
                Descartar denúncias{Object.values(reporters).some(Boolean) ? " e punir denunciantes" : ""}
              </Button>
            </div>
          </div>
          {!reasonOk && <p className="text-xs text-[var(--muted)]">Informe o motivo (mínimo 5 caracteres) para decidir.</p>}
          {confirm && (
            <div role="alertdialog" aria-label="Confirmar decisão" className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
              <span className="flex-1">{confirm === "DELETE" ? "Confirmar a exclusão definitiva desta mídia?" : "Confirmar o descarte das denúncias?"}</span>
              <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>
                Voltar
              </Button>
              <Button type="button" variant={confirm === "DELETE" ? "danger" : "primary"} loading={decide.isPending} onClick={() => decide.mutate(confirm)}>
                Confirmar
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Sanctions() {
  const [active, setActive] = useState(true);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { toast } = useToast();
  const list = useAdminList<SanctionRow>("sanctions", { active: active ? 1 : 0, page, pageSize: 30 });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/admin/sanctions/${id}/revoke`, { method: "POST", partnerId: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "sanctions"] });
      toast("Sanção revogada.", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const rows = list.data?.items ?? [];
  return (
    <div className="space-y-3">
      <Checkbox label="Só sanções ativas" checked={active} onChange={(e) => { setActive(e.target.checked); setPage(1); }} />
      <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()} isEmpty={rows.length === 0} empty={<Empty title="Nenhuma sanção" />}>
        <Table>
          <thead>
            <tr>
              <th className={th}>Usuário</th>
              <th className={th}>Sanção</th>
              <th className={th}>Motivo</th>
              <th className={th}>Aplicada</th>
              <th className={cn(th, "text-right")}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="align-top">
                <td className={td}>
                  {s.user.name}
                  <span className="block text-xs text-[var(--muted)]">{s.user.email}</span>
                </td>
                <td className={td}>
                  <Badge tone={s.active ? "red" : "gray"}>{KIND_LABEL[s.kind]}</Badge>
                  <span className="block text-xs text-[var(--muted)]">
                    {s.ip ? `${s.ip} · ` : ""}
                    {s.revokedAt ? `revogada em ${fmtDateTime(s.revokedAt)}${s.revokedBy ? ` por ${s.revokedBy.name}` : ""}` : until(s)}
                  </span>
                </td>
                <td className={cn(td, "max-w-xs text-xs")}>{s.reason}</td>
                <td className={cn(td, "whitespace-nowrap text-xs")}>
                  {fmtDateTime(s.createdAt)}
                  <span className="block text-[var(--muted)]">por {s.createdBy.name}</span>
                </td>
                <td className={cn(td, "text-right")}>
                  {s.active && (
                    <Button type="button" variant="secondary" className="h-8 px-2 text-xs" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                      Revogar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {list.data?.meta && <Pagination page={page} pageSize={list.data.meta.pageSize} total={list.data.meta.total} onChange={setPage} />}
      </QueryState>
    </div>
  );
}
