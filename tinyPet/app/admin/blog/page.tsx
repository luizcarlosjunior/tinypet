"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Eye, Heart, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";
import { ConfirmDialog, Pagination, SearchInput, Table, Tabs, td, th } from "@/components/painel/ui";
import { useToast } from "@/components/ui/toast";
import { BlogQueryState, fmtInt } from "@/components/admin/blog/common";
import { BLOG_STATUS_LABEL, BLOG_STATUS_TONE, flattenCategories, useBlogCategories, useBlogPostMutations, useBlogPosts, type BlogPostRow, type BlogPostStatus } from "@/hooks/use-blog-admin";
import { fmtSpDateTime } from "@/lib/blog-utils";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Tab = "ALL" | BlogPostStatus;

export default function BlogPostsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("ALL");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<BlogPostRow | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const posts = useBlogPosts({ q: debounced, status: tab === "ALL" ? undefined : tab, categoryId: categoryId || undefined, page, pageSize: 20 });
  const cats = useBlogCategories();
  const m = useBlogPostMutations();
  const rows = posts.data?.items ?? [];
  const meta = posts.data?.meta;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Blog"
        description="Posts do blog: rascunhos, agendados e publicados."
        actions={
          <Link href="/admin/blog/novo" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden /> Novo post
          </Link>
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        items={[{ key: "ALL", label: "Todos" }, ...(Object.keys(BLOG_STATUS_LABEL) as BlogPostStatus[]).map((s) => ({ key: s as Tab, label: BLOG_STATUS_LABEL[s] }))]}
      />
      <div className="flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por título…" className="min-w-[220px] flex-1" label="Buscar posts" />
        <select
          className="input w-auto"
          aria-label="Filtrar por categoria"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as categorias</option>
          {flattenCategories(cats.data ?? []).map(({ node, depth }) => (
            <option key={node.id} value={node.id}>
              {"  ".repeat(depth * 2)}
              {depth ? "↳ " : ""}
              {node.name}
            </option>
          ))}
        </select>
      </div>
      <BlogQueryState isLoading={posts.isLoading} error={posts.error} retry={() => posts.refetch()}>
        <Table>
          <thead>
            <tr>
              <th className={th}>Post</th>
              <th className={th}>Status</th>
              <th className={cn(th, "hidden md:table-cell")}>Categorias</th>
              <th className={cn(th, "hidden lg:table-cell")}>Publicação</th>
              <th className={cn(th, "hidden sm:table-cell")}>Engajamento</th>
              <th className={cn(th, "text-right")}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className={cn(td, "py-8 text-center text-[var(--muted)]")}>
                  Nenhum post encontrado.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-ink-50/60 dark:hover:bg-ink-900/40">
                <td className={td}>
                  <div className="flex items-center gap-3">
                    {p.coverImageRect ? <img src={p.coverImageRect} alt="" className="hidden h-10 w-16 shrink-0 rounded-lg object-cover sm:block" /> : <div className="hidden h-10 w-16 shrink-0 rounded-lg bg-ink-100 dark:bg-ink-800 sm:block" />}
                    <div className="min-w-0">
                      <Link href={`/admin/blog/${p.id}`} className="line-clamp-2 font-medium hover:text-brand-600">
                        {p.title}
                      </Link>
                      <p className="truncate text-xs text-[var(--muted)]">
                        /{p.slug}
                        {p.author?.name && ` · ${p.author.name}`}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={td}>
                  <Badge tone={BLOG_STATUS_TONE[p.status] ?? "gray"}>{BLOG_STATUS_LABEL[p.status] ?? p.status}</Badge>
                </td>
                <td className={cn(td, "hidden text-xs md:table-cell")}>{(p.categories ?? []).map((c) => c.name).join(", ") || "—"}</td>
                <td className={cn(td, "hidden whitespace-nowrap text-xs lg:table-cell")}>{fmtSpDateTime(p.publishDate)}</td>
                <td className={cn(td, "hidden whitespace-nowrap text-xs text-[var(--muted)] sm:table-cell")}>
                  <span className="mr-2 inline-flex items-center gap-1" title="Visualizações">
                    <Eye className="h-3.5 w-3.5" aria-hidden /> {fmtInt(p.views)}
                  </span>
                  <span className="mr-2 inline-flex items-center gap-1" title="Curtidas">
                    <Heart className="h-3.5 w-3.5" aria-hidden /> {fmtInt(p.heartsCount)}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Comentários">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden /> {fmtInt(p.commentsCount)}
                  </span>
                </td>
                <td className={cn(td, "whitespace-nowrap text-right")}>
                  <Link href={`/admin/blog/${p.id}`} className="btn-ghost h-8 w-8 p-0" aria-label={`Editar ${p.title}`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                  {p.status === "PUBLISHED" && (
                    <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost h-8 w-8 p-0" aria-label={`Abrir ${p.title} no blog`}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={() => setToDelete(p)} aria-label={`Excluir ${p.title}`}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onChange={setPage} />}
      </BlogQueryState>
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        danger
        title="Excluir post?"
        description={toDelete ? `"${toDelete.title}" sai do blog (exclusão lógica).` : undefined}
        confirmLabel="Excluir"
        loading={m.remove.isPending}
        onConfirm={() =>
          toDelete &&
          m.remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast("Post excluído", "success");
              setToDelete(null);
            },
            onError: (e) => toast(errorMessage(e), "error"),
          })
        }
      />
    </div>
  );
}
