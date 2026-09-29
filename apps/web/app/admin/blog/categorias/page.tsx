"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, CornerDownRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Input, Modal, PageHeader, Select, Textarea } from "@/components/ui";
import { Checkbox, ConfirmDialog } from "@/components/painel/ui";
import { useToast } from "@/components/ui/toast";
import { BlogQueryState } from "@/components/admin/blog/common";
import { useBlogCategories, useBlogCategoryMutations, type BlogCategoryNode } from "@/hooks/use-blog-admin";
import { ApiClientError } from "@/lib/api-client";
import { blogSlugify } from "@/lib/blog-utils";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Draft = { id?: string; name: string; slug: string; description: string; parentId: string; active: boolean; slugTouched: boolean; hasChildren: boolean };
const sortNodes = (a: BlogCategoryNode[]) => [...a].sort((x, y) => x.sortOrder - y.sortOrder || x.name.localeCompare(y.name));

export default function BlogCategoriesPage() {
  const { toast } = useToast();
  const cats = useBlogCategories();
  const m = useBlogCategoryMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<{ node: BlogCategoryNode; needsForce?: boolean; message?: string } | null>(null);
  const [moving, setMoving] = useState(false);
  const tree = sortNodes(cats.data ?? []);

  const openNew = (parentId = "") => setDraft({ name: "", slug: "", description: "", parentId, active: true, slugTouched: false, hasChildren: false });
  const openEdit = (n: BlogCategoryNode, parentId: string | null) => setDraft({ id: n.id, name: n.name, slug: n.slug, description: n.description ?? "", parentId: parentId ?? "", active: n.active, slugTouched: true, hasChildren: !!n.children?.length });

  const submit = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast("Informe o nome.", "error");
      return;
    }
    const siblings = draft.parentId ? (tree.find((t) => t.id === draft.parentId)?.children ?? []) : tree;
    const body = { name: draft.name.trim(), slug: blogSlugify(draft.slug || draft.name) || undefined, description: draft.description.trim() || null, parentId: draft.parentId || null, active: draft.active };
    if (draft.id) m.update.mutate({ id: draft.id, body: body as Partial<BlogCategoryNode> }, { onSuccess: () => setDraft(null) });
    else m.create.mutate({ ...body, sortOrder: (siblings.length ? Math.max(...siblings.map((s) => s.sortOrder)) : 0) + 10 } as Partial<BlogCategoryNode>, { onSuccess: () => setDraft(null) });
  };

  /** Swaps with the neighbour and renumbers siblings (10, 20, …); PATCHes only what changed. */
  const move = async (siblings: BlogCategoryNode[], index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= siblings.length) return;
    const order = [...siblings];
    [order[index], order[j]] = [order[j]!, order[index]!];
    setMoving(true);
    try {
      for (const [i, n] of order.entries()) {
        const sortOrder = (i + 1) * 10;
        if (n.sortOrder !== sortOrder) await m.update.mutateAsync({ id: n.id, body: { sortOrder }, silent: true });
      }
    } finally {
      setMoving(false);
    }
  };

  const doDelete = (force?: boolean) => {
    if (!toDelete) return;
    m.remove.mutate(
      { id: toDelete.node.id, force },
      {
        onSuccess: () => setToDelete(null),
        onError: (e) => {
          if (e instanceof ApiClientError && e.status === 409 && !force && !toDelete.node.children?.length) setToDelete({ ...toDelete, needsForce: true, message: e.message });
          else {
            toast(errorMessage(e), "error");
            setToDelete(null);
          }
        },
      },
    );
  };

  const row = (n: BlogCategoryNode, siblings: BlogCategoryNode[], i: number, parentId: string | null) => (
    <div className={cn("flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-ink-50 dark:hover:bg-ink-900/50", parentId && "pl-8")}>
      {parentId && <CornerDownRight className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", !parentId && "font-semibold")}>
          {n.name} {!n.active && <Badge className="ml-1">Inativa</Badge>}
        </p>
        <p className="truncate text-xs text-[var(--muted)]">
          /{n.slug} · {n.postCount ?? 0} post(s)
        </p>
      </div>
      <button type="button" className="btn-ghost h-8 w-8 p-0" disabled={i === 0 || moving} onClick={() => move(siblings, i, -1)} aria-label={`Subir ${n.name}`}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" className="btn-ghost h-8 w-8 p-0" disabled={i === siblings.length - 1 || moving} onClick={() => move(siblings, i, 1)} aria-label={`Descer ${n.name}`}>
        <ArrowDown className="h-4 w-4" />
      </button>
      {!parentId && (
        <button type="button" className="btn-ghost h-8 px-2 text-xs" onClick={() => openNew(n.id)} aria-label={`Nova subcategoria em ${n.name}`}>
          <Plus className="h-3.5 w-3.5" /> Sub
        </button>
      )}
      <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={() => openEdit(n, parentId)} aria-label={`Editar ${n.name}`}>
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={() => setToDelete({ node: n })} aria-label={`Excluir ${n.name}`}>
        <Trash2 className="h-4 w-4 text-red-600" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categorias do blog"
        description="Categorias e subcategorias (2 níveis). Use as setas para ordenar."
        actions={
          <Button type="button" onClick={() => openNew()}>
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        }
      />
      <BlogQueryState isLoading={cats.isLoading} error={cats.error} retry={() => cats.refetch()}>
        {tree.length === 0 ? (
          <p className="card text-sm text-[var(--muted)]">Nenhuma categoria ainda.</p>
        ) : (
          <ul className="card space-y-1 p-2">
            {tree.map((n, i) => {
              const kids = sortNodes(n.children ?? []);
              return (
                <li key={n.id}>
                  {row(n, tree, i, null)}
                  {kids.length > 0 && (
                    <ul className="space-y-0.5">
                      {kids.map((c, j) => (
                        <li key={c.id}>{row(c, kids, j, n.id)}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </BlogQueryState>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Editar categoria" : "Nova categoria"}>
        {draft && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input id="cat-name" label="Nome" value={draft.name} maxLength={120} required onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.slugTouched ? draft.slug : blogSlugify(e.target.value) })} />
            <Input id="cat-slug" label="Slug" value={draft.slug} maxLength={140} className="font-mono text-xs" onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"), slugTouched: true })} />
            <Select id="cat-parent" label="Categoria pai" value={draft.parentId} disabled={draft.hasChildren} onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}>
              <option value="">— Nenhuma (categoria principal) —</option>
              {tree
                .filter((t) => t.id !== draft.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </Select>
            {draft.hasChildren && <p className="text-xs text-[var(--muted)]">Possui subcategorias, então não pode virar subcategoria.</p>}
            <Textarea id="cat-desc" label="Descrição" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <Checkbox checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} label="Ativa (visível no blog)" />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={m.create.isPending || m.update.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => doDelete(!!toDelete?.needsForce)}
        danger
        loading={m.remove.isPending}
        title={toDelete?.needsForce ? "Categoria em uso" : "Excluir categoria?"}
        description={toDelete?.needsForce ? `${toDelete.message ?? "A categoria tem posts."} Excluir mesmo assim e desvincular os posts?` : toDelete?.node.children?.length ? "Remova ou mova as subcategorias antes." : `"${toDelete?.node.name}" será excluída.`}
        confirmLabel={toDelete?.needsForce ? "Excluir e desvincular" : "Excluir"}
      />
    </div>
  );
}
