"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Link2, Pencil, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { Badge, Button, Input, Modal, PageHeader, Spinner } from "@/components/ui";
import { ConfirmDialog, Pagination, SearchInput, Tabs } from "@/components/painel/ui";
import { useToast } from "@/components/ui/toast";
import { BlogQueryState } from "@/components/admin/blog/common";
import { MediaUploadDialog } from "@/components/admin/blog/MediaUploadDialog";
import { useBlogMedia, useBlogMediaMutations, useBlogMediaUsage } from "@/hooks/use-blog-admin";
import { ApiClientError } from "@/lib/api-client";
import { formatBytes, type BlogMediaItem } from "@/lib/blog-media";
import { fmtSpDateTime } from "@/lib/blog-utils";
import { errorMessage } from "@/lib/errors";

const FIELD_LABEL: Record<string, string> = { content: "Conteúdo", coverImageRect: "Capa 16:9", coverImageSquare: "Capa 1:1", coverOgImage: "Imagem OG" };

export default function BlogMediaPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"list" | "trash">("list");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState("");
  const [inUse, setInUse] = useState("");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [altEdit, setAltEdit] = useState<{ item: BlogMediaItem; alt: string } | null>(null);
  const [usageOf, setUsageOf] = useState<BlogMediaItem | null>(null);
  const [toDelete, setToDelete] = useState<{ item: BlogMediaItem; force?: boolean; message?: string } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const media = useBlogMedia({ q: debounced, type: type || undefined, inUse: inUse || undefined, trash: tab === "trash", page, pageSize: 24 });
  const usage = useBlogMediaUsage(usageOf?.id ?? null);
  const m = useBlogMediaMutations();
  const items = media.data?.items ?? [];
  const meta = media.data?.meta;

  const copy = (url: string) => navigator.clipboard?.writeText(url).then(() => toast("URL copiada", "success"), () => undefined);
  const doDelete = () => {
    if (!toDelete) return;
    m.remove.mutate(
      { id: toDelete.item.id, force: toDelete.force },
      {
        onSuccess: () => {
          toast("Mídia movida para a lixeira", "success");
          setToDelete(null);
        },
        onError: (e) => {
          if (e instanceof ApiClientError && e.status === 409 && !toDelete.force) setToDelete({ ...toDelete, force: true, message: e.message });
          else {
            toast(errorMessage(e), "error");
            setToDelete(null);
          }
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mídia do blog"
        description="Biblioteca de imagens usadas nos posts."
        actions={
          <Button type="button" onClick={() => setUploadOpen(true)}>
            <UploadCloud className="h-4 w-4" /> Enviar imagens
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        items={[
          { key: "list", label: "Ativos" },
          { key: "trash", label: "Lixeira" },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Nome do arquivo ou alt…" className="min-w-[220px] flex-1" label="Buscar mídia" />
        <select className="input w-auto" aria-label="Tipo" value={type} onChange={(e) => (setType(e.target.value), setPage(1))}>
          <option value="">Todos os tipos</option>
          <option value="webp">WebP</option>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="gif">GIF</option>
        </select>
        {tab === "list" && (
          <select className="input w-auto" aria-label="Uso" value={inUse} onChange={(e) => (setInUse(e.target.value), setPage(1))}>
            <option value="">Em uso ou não</option>
            <option value="1">Em uso</option>
            <option value="0">Sem uso</option>
          </select>
        )}
      </div>
      <BlogQueryState isLoading={media.isLoading} error={media.error} retry={() => media.refetch()}>
        {items.length === 0 ? (
          <p className="card py-10 text-center text-sm text-[var(--muted)]">{tab === "trash" ? "Lixeira vazia." : "Nenhuma imagem encontrada."}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((it) => (
              <li key={it.id} className="card flex flex-col overflow-hidden p-0">
                <a href={it.url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-ink-100 dark:bg-ink-800">
                  <img src={it.url} alt={it.alt ?? it.originalFilename} className="h-full w-full object-cover" loading="lazy" />
                </a>
                <div className="flex flex-1 flex-col gap-1 p-2">
                  <p className="truncate text-xs font-medium" title={it.originalFilename}>
                    {it.originalFilename}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {it.width && it.height ? `${it.width}×${it.height} · ` : ""}
                    {formatBytes(it.size)} · {(it.mimeType ?? "").replace("image/", "").toUpperCase()}
                  </p>
                  {it.alt ? <p className="truncate text-[11px] text-[var(--muted)]">alt: {it.alt}</p> : <Badge tone="amber" className="self-start text-[10px]">sem alt</Badge>}
                  {it.createdAt && <p className="text-[10px] text-[var(--muted)]">{fmtSpDateTime(it.createdAt)}</p>}
                  <div className="mt-auto flex flex-wrap gap-0.5 pt-1">
                    {tab === "list" ? (
                      <>
                        <button type="button" className="btn-ghost h-7 w-7 p-0" onClick={() => copy(it.url)} aria-label="Copiar URL" title="Copiar URL">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="btn-ghost h-7 w-7 p-0" onClick={() => setAltEdit({ item: it, alt: it.alt ?? "" })} aria-label="Editar alt" title="Editar texto alternativo">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="btn-ghost h-7 w-7 p-0" onClick={() => setUsageOf(it)} aria-label="Ver uso" title="Onde é usada">
                          <Link2 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="btn-ghost ml-auto h-7 w-7 p-0" onClick={() => setToDelete({ item: it })} aria-label="Excluir" title="Mover para a lixeira">
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full py-1 text-xs"
                        loading={m.restore.isPending && m.restore.variables === it.id}
                        onClick={() => m.restore.mutate(it.id, { onSuccess: () => toast("Mídia restaurada", "success"), onError: (e) => toast(errorMessage(e), "error") })}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onChange={setPage} />}
      </BlogQueryState>

      <MediaUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={() => m.invalidate()} />

      <Modal open={!!altEdit} onClose={() => setAltEdit(null)} title="Texto alternativo">
        {altEdit && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              m.updateAlt.mutate(
                { id: altEdit.item.id, alt: altEdit.alt.trim() },
                { onSuccess: () => (toast("Alt salvo", "success"), setAltEdit(null)), onError: (err) => toast(errorMessage(err), "error") },
              );
            }}
          >
            <img src={altEdit.item.url} alt="" className="max-h-48 w-full rounded-xl object-contain" />
            <Input id="media-alt" label="Descrição da imagem" value={altEdit.alt} maxLength={300} onChange={(e) => setAltEdit({ ...altEdit, alt: e.target.value })} autoFocus />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAltEdit(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={m.updateAlt.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!usageOf} onClose={() => setUsageOf(null)} title="Onde esta imagem é usada">
        {usage.isLoading ? (
          <Spinner />
        ) : usage.error ? (
          <p className="text-sm text-red-600">{errorMessage(usage.error)}</p>
        ) : (usage.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Não está em uso em nenhum post.</p>
        ) : (
          <ul className="space-y-2">
            {(usage.data ?? []).map((u, i) => (
              <li key={`${u.postId}-${u.field}-${i}`} className="flex items-center justify-between gap-2 rounded-xl border p-2 text-sm">
                <Link href={`/admin/blog/${u.postId}`} className="truncate font-medium hover:text-brand-600">
                  {u.title}
                </Link>
                <Badge>{FIELD_LABEL[u.field] ?? u.field}</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setUsageOf(null)}>
            Fechar
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        danger
        loading={m.remove.isPending}
        title={toDelete?.force ? "Imagem em uso" : "Mover para a lixeira?"}
        description={toDelete?.force ? `${toDelete.message ?? "Esta imagem está em uso."} Excluir mesmo assim? Os posts ficarão com a imagem quebrada.` : "Você pode restaurá-la pela aba Lixeira."}
        confirmLabel={toDelete?.force ? "Excluir mesmo assim" : "Mover para a lixeira"}
      />
    </div>
  );
}
