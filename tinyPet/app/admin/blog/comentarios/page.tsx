"use client";
import { useState } from "react";
import Link from "next/link";
import { EyeOff, Flag, Heart, RotateCcw, ShieldCheck, Trash2, ExternalLink, CornerDownRight } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";
import { ConfirmDialog, Pagination, Tabs } from "@/components/painel/ui";
import { BlogQueryState, fmtInt } from "@/components/admin/blog/common";
import { useBlogComments, useModerateComment, type BlogCommentAction, type BlogCommentRow } from "@/hooks/use-blog-admin";
import { fmtSpDateTime } from "@/lib/blog-utils";

type Tab = "all" | "reported" | "hidden";
const STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" | "gray" }> = { VISIBLE: { label: "Visível", tone: "green" }, HIDDEN: { label: "Oculto", tone: "amber" }, DELETED: { label: "Excluído", tone: "red" } };

export default function BlogCommentsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<BlogCommentRow | null>(null);
  const list = useBlogComments({ status: tab === "hidden" ? "HIDDEN" : undefined, reported: tab === "reported" || undefined, page });
  const mod = useModerateComment();
  const rows = list.data?.items ?? [];
  const meta = list.data?.meta;
  const act = (id: string, action: BlogCommentAction) => mod.mutate({ id, action });

  return (
    <div className="space-y-4">
      <PageHeader title="Comentários do blog" description="Modere comentários: ocultar, restaurar, excluir ou descartar denúncias." />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        items={[
          { key: "all", label: "Todos" },
          { key: "reported", label: "Reportados" },
          { key: "hidden", label: "Ocultos" },
        ]}
      />
      <BlogQueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()}>
        {rows.length === 0 ? (
          <p className="card py-10 text-center text-sm text-[var(--muted)]">Nenhum comentário aqui.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((c) => {
              const st = STATUS[c.status] ?? { label: c.status, tone: "gray" as const };
              const busy = mod.isPending && mod.variables?.id === c.id;
              return (
                <li key={c.id} className="card space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {c.parentId && <CornerDownRight className="h-4 w-4 text-[var(--muted)]" aria-label="Resposta" />}
                    <span className="font-medium">{c.user?.name ?? "Usuário removido"}</span>
                    {c.user?.username && <span className="text-xs text-[var(--muted)]">@{c.user.username}</span>}
                    {c.user?.email && <span className="text-xs text-[var(--muted)]">{c.user.email}</span>}
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {!!c.reportsOpen && (
                      <Badge tone="red">
                        <Flag className="mr-1 h-3 w-3" aria-hidden /> {c.reportsOpen} denúncia(s)
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-[var(--muted)]">{fmtSpDateTime(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" aria-hidden /> {fmtInt(c.heartsCount)}
                    </span>
                    {c.post && (
                      <>
                        <span>em</span>
                        <Link href={`/admin/blog/${c.post.id}`} className="font-medium text-[var(--fg)] hover:text-brand-600">
                          {c.post.title}
                        </Link>
                        <a href={`/blog/${c.post.slug}#comentarios`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-brand-600" aria-label="Abrir post no blog">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </>
                    )}
                    <div className="ml-auto flex flex-wrap gap-1">
                      {c.status === "VISIBLE" && (
                        <button type="button" className="btn-secondary px-2.5 py-1 text-xs" disabled={busy} onClick={() => act(c.id, "HIDE")}>
                          <EyeOff className="h-3.5 w-3.5" /> Ocultar
                        </button>
                      )}
                      {c.status !== "VISIBLE" && (
                        <button type="button" className="btn-secondary px-2.5 py-1 text-xs" disabled={busy} onClick={() => act(c.id, "RESTORE")}>
                          <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                        </button>
                      )}
                      {!!c.reportsOpen && (
                        <button type="button" className="btn-secondary px-2.5 py-1 text-xs" disabled={busy} onClick={() => act(c.id, "DISMISS_REPORTS")}>
                          <ShieldCheck className="h-3.5 w-3.5" /> Descartar denúncias
                        </button>
                      )}
                      {c.status !== "DELETED" && (
                        <button type="button" className="btn-ghost px-2.5 py-1 text-xs text-red-600" disabled={busy} onClick={() => setConfirm(c)}>
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onChange={setPage} />}
      </BlogQueryState>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        danger
        title="Excluir comentário?"
        description="O comentário deixa de aparecer no post."
        confirmLabel="Excluir"
        loading={mod.isPending}
        onConfirm={() => confirm && mod.mutate({ id: confirm.id, action: "DELETE" }, { onSuccess: () => setConfirm(null) })}
      />
    </div>
  );
}
