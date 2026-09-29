"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, FileText, Heart, MessageSquare, Users } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { StatCard, Table, td, th } from "@/components/painel/ui";
import { BlogQueryState, fmtInt } from "@/components/admin/blog/common";
import { PublishedBarChart, RankBars, ViewsAreaChart } from "@/components/admin/blog/StatsCharts";
import { flattenCategories, useBlogCategories, useBlogPosts, useBlogStats, type BlogStatsPeriod } from "@/hooks/use-blog-admin";
import { cn } from "@/lib/utils";

const PERIODS: { key: BlogStatsPeriod; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "12m", label: "12 meses" },
  { key: "custom", label: "Personalizado" },
];
const DEVICE_LABEL: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tablet", bot: "Robô", other: "Outro", unknown: "Desconhecido" };

export default function BlogStatsPage() {
  const [period, setPeriod] = useState<BlogStatsPeriod>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [postId, setPostId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const customReady = period !== "custom" || (!!from && !!to && from <= to);
  const stats = useBlogStats({ period, from: period === "custom" ? from : undefined, to: period === "custom" ? to : undefined, postId: postId || undefined, categoryId: categoryId || undefined }, customReady);
  const cats = useBlogCategories();
  const posts = useBlogPosts({ status: "PUBLISHED", pageSize: 100, page: 1 });
  const s = stats.data;

  return (
    <div className="space-y-4">
      <PageHeader title="Estatísticas do blog" description="Visualizações, visitantes únicos e engajamento (horário de Brasília)." />
      <div className="flex flex-wrap items-end gap-2">
        <div role="group" aria-label="Período" className="flex flex-wrap gap-1 rounded-xl border bg-[var(--card)] p-1">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", period === p.key ? "bg-brand-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <>
            <div>
              <label htmlFor="st-from" className="label">
                De
              </label>
              <input id="st-from" type="date" className="input w-auto" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="st-to" className="label">
                Até
              </label>
              <input id="st-to" type="date" className="input w-auto" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}
        <select className="input w-auto max-w-[240px]" aria-label="Filtrar por post" value={postId} onChange={(e) => setPostId(e.target.value)}>
          <option value="">Todos os posts</option>
          {(posts.data?.items ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select className="input w-auto" aria-label="Filtrar por categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Todas as categorias</option>
          {flattenCategories(cats.data ?? []).map(({ node, depth }) => (
            <option key={node.id} value={node.id}>
              {depth ? "↳ " : ""}
              {node.name}
            </option>
          ))}
        </select>
      </div>
      {!customReady ? (
        <p className="card text-sm text-[var(--muted)]">Escolha as datas inicial e final.</p>
      ) : (
        <BlogQueryState isLoading={stats.isLoading} error={stats.error} retry={() => stats.refetch()}>
          {s && (
            <div className={cn("space-y-4 transition", stats.isFetching && "opacity-60")}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatCard label="Visualizações" value={fmtInt(s.totals.views)} icon={<Eye className="h-4 w-4" />} />
                <StatCard label="Visitantes" value={fmtInt(s.totals.visitors)} icon={<Users className="h-4 w-4" />} />
                <StatCard label="Curtidas" value={fmtInt(s.totals.hearts)} icon={<Heart className="h-4 w-4" />} />
                <StatCard label="Comentários" value={fmtInt(s.totals.comments)} icon={<MessageSquare className="h-4 w-4" />} />
                <StatCard label="Publicados" value={fmtInt(s.totals.published)} icon={<FileText className="h-4 w-4" />} />
              </div>
              <Card title="Visualizações e visitantes">
                {s.series.length ? <ViewsAreaChart series={s.series} /> : <p className="py-10 text-center text-sm text-[var(--muted)]">Sem dados no período.</p>}
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Posts publicados">{s.series.length ? <PublishedBarChart series={s.series} /> : <p className="py-10 text-center text-sm text-[var(--muted)]">Sem dados.</p>}</Card>
                <Card title="Por categoria">
                  <RankBars rows={s.byCategory.slice(0, 10).map((c) => ({ label: c.name, value: c.views }))} />
                </Card>
              </div>
              <Card title="Posts mais lidos">
                {s.topPosts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--muted)]">Sem dados no período.</p>
                ) : (
                  <Table className="border-0">
                    <thead>
                      <tr>
                        <th className={th}>Post</th>
                        <th className={cn(th, "text-right")}>Visualizações</th>
                        <th className={cn(th, "text-right")}>Curtidas</th>
                        <th className={cn(th, "text-right")}>Comentários</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.topPosts.map((p) => (
                        <tr key={p.id}>
                          <td className={td}>
                            <Link href={`/admin/blog/${p.id}`} className="font-medium hover:text-brand-600">
                              {p.title}
                            </Link>
                          </td>
                          <td className={cn(td, "text-right tabular-nums")}>{fmtInt(p.views)}</td>
                          <td className={cn(td, "text-right tabular-nums")}>{fmtInt(p.hearts)}</td>
                          <td className={cn(td, "text-right tabular-nums")}>{fmtInt(p.comments)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Origem do tráfego">
                  <RankBars rows={s.referrers.slice(0, 10).map((r) => ({ label: r.host || "Direto", value: r.views }))} />
                </Card>
                <Card title="Dispositivos">
                  <RankBars rows={s.devices.map((d) => ({ label: DEVICE_LABEL[d.device?.toLowerCase()] ?? d.device, value: d.views }))} />
                </Card>
              </div>
              <p className="text-xs text-[var(--muted)]">Origem e dispositivos consideram no máximo os últimos 90 dias.</p>
            </div>
          )}
        </BlogQueryState>
      )}
    </div>
  );
}
