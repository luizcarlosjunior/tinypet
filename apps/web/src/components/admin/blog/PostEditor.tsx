"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { ArrowLeft, Eye, History, Save, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import { ConfirmDialog, Drawer, Switch } from "@/components/painel/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { CROP_PRESETS } from "@/lib/blog-media";
import { BLOG_TZ, blogSlugify, countWords, fmtSpDateTime, fromSpInputValue, normalizeTags, readingMinutes, SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, SUMMARY_MAX, toSpInputValue } from "@/lib/blog-utils";
import { BLOG_STATUS_LABEL, BLOG_STATUS_TONE, useBlogCategories, useBlogPostMutations, type BlogPostFull, type BlogPostInput, type BlogPostStatus } from "@/hooks/use-blog-admin";
import { cn } from "@/lib/utils";
import { BlogEditor, type EditorStats } from "./BlogEditor";
import { CategoryTreePicker } from "./CategoryTreePicker";
import { CropUploader } from "./CropUploader";
import { SeoPreview } from "./SeoPreview";
import { SlugInput } from "./SlugInput";
import { TagsInput } from "./TagsInput";
import { ApiNotice, isApiMissing } from "./common";

type FormState = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  status: BlogPostStatus;
  publishLocal: string;
  categoryIds: string[];
  tags: string[];
  coverImageRect: string | null;
  coverImageSquare: string | null;
  coverOgImage: string | null;
  coverAlt: string;
  useCustomSeoTitle: boolean;
  seoTitle: string;
  useCustomSeoDescription: boolean;
  seoDescription: string;
  featured: boolean;
  commentsEnabled: boolean;
};

const EMPTY: FormState = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  status: "DRAFT",
  publishLocal: "",
  categoryIds: [],
  tags: [],
  coverImageRect: null,
  coverImageSquare: null,
  coverOgImage: null,
  coverAlt: "",
  useCustomSeoTitle: false,
  seoTitle: "",
  useCustomSeoDescription: false,
  seoDescription: "",
  featured: false,
  commentsEnabled: true,
};

function fromPost(p: BlogPostFull & { tags: string[]; categoryIds: string[] }): FormState {
  return {
    title: p.title ?? "",
    slug: p.slug ?? "",
    summary: p.summary ?? "",
    content: p.content ?? "",
    status: p.status ?? "DRAFT",
    publishLocal: toSpInputValue(p.publishDate),
    categoryIds: p.categoryIds,
    tags: p.tags,
    coverImageRect: p.coverImageRect ?? null,
    coverImageSquare: p.coverImageSquare ?? null,
    coverOgImage: p.coverOgImage ?? null,
    coverAlt: p.coverAlt ?? "",
    useCustomSeoTitle: !!p.seoTitle && p.seoTitle !== p.title,
    seoTitle: p.seoTitle ?? "",
    useCustomSeoDescription: !!p.seoDescription && p.seoDescription !== p.summary,
    seoDescription: p.seoDescription ?? "",
    featured: !!p.featured,
    commentsEnabled: p.commentsEnabled ?? true,
  };
}

function toInput(f: FormState): BlogPostInput {
  return {
    title: f.title.trim(),
    slug: f.slug.trim() || undefined,
    summary: f.summary.trim() || null,
    content: f.content,
    status: f.status,
    publishDate: fromSpInputValue(f.publishLocal),
    categoryIds: f.categoryIds,
    tags: normalizeTags(f.tags),
    coverImageRect: f.coverImageRect,
    coverImageSquare: f.coverImageSquare,
    coverOgImage: f.coverOgImage,
    coverAlt: f.coverAlt.trim() || null,
    seoTitle: f.useCustomSeoTitle ? f.seoTitle.trim() || null : null,
    seoDescription: f.useCustomSeoDescription ? f.seoDescription.trim() || null : null,
    featured: f.featured,
    commentsEnabled: f.commentsEnabled,
  };
}

function validate(f: FormState): string | null {
  if (f.title.trim().length < 3) return "Informe um título (mín. 3 caracteres).";
  if (f.title.length > 200) return "Título muito longo (máx. 200).";
  if (f.summary.length > SUMMARY_MAX) return `Resumo com mais de ${SUMMARY_MAX} caracteres.`;
  if (f.useCustomSeoTitle && f.seoTitle.length > SEO_TITLE_MAX) return `Título SEO com mais de ${SEO_TITLE_MAX} caracteres.`;
  if (f.useCustomSeoDescription && f.seoDescription.length > SEO_DESCRIPTION_MAX) return `Descrição SEO com mais de ${SEO_DESCRIPTION_MAX} caracteres.`;
  if (f.status === "SCHEDULED") {
    const iso = fromSpInputValue(f.publishLocal);
    if (!iso) return "Informe a data e hora do agendamento.";
    if (new Date(iso).getTime() <= Date.now()) return "O agendamento precisa ser em uma data futura.";
  }
  if (f.status === "PUBLISHED" && !f.content.trim()) return "O conteúdo está vazio.";
  return null;
}

const draftKey = (id: string | null) => `tinypet.blog.draft.${id ?? "new"}`;
type LocalDraft = { form: FormState; savedAt: string };
function readDraft(id: string | null): LocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}
function clearDraft(id: string | null) {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    /* ignore */
  }
}

export function PostEditor({ post }: { post?: (BlogPostFull & { tags: string[]; categoryIds: string[] }) | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const postId = post?.id ?? null;
  const initial = useMemo(() => (post ? fromPost(post) : EMPTY), [post]);
  const [form, setForm] = useState<FormState>(initial);
  const [baseline, setBaseline] = useState<FormState>(initial);
  const [editorKey, setEditorKey] = useState(0);
  const [stats, setStats] = useState<EditorStats>({ words: countWords(""), characters: 0 });
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baseUrl, setBaseUrl] = useState(process.env.NEXT_PUBLIC_APP_URL ?? "");
  const categories = useBlogCategories();
  const m = useBlogPostMutations();
  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v })), []);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!baseUrl && typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, [baseUrl]);

  // Offer to restore a local draft newer than the server copy.
  useEffect(() => {
    const d = readDraft(postId);
    if (!d) return;
    const serverTime = post?.updatedAt ? new Date(post.updatedAt).getTime() : 0;
    if (JSON.stringify(d.form) !== JSON.stringify(initial) && new Date(d.savedAt).getTime() > serverTime) setDraft(d);
    else clearDraft(postId);
  }, [postId, post?.updatedAt, initial]);

  // Autosave to localStorage (debounced) while there are unsaved changes.
  useEffect(() => {
    if (!dirty || draft) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(postId), JSON.stringify({ form, savedAt: new Date().toISOString() } satisfies LocalDraft));
      } catch {
        /* quota / private mode */
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [form, dirty, draft, postId]);

  // Warn when leaving with unsaved changes (reload/close + in-app links).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm("Há alterações não salvas. Sair mesmo assim?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const save = async (override?: Partial<FormState>) => {
    const f = { ...form, ...override };
    const err = validate(f);
    if (err) {
      toast(err, "error");
      return;
    }
    setSaving(true);
    try {
      const body = toInput(f);
      // New post with the auto slug: let the server pick a unique one (it suffixes "-2", "-3"… on collisions).
      if (!postId && body.slug === blogSlugify(f.title)) delete body.slug;
      const saved = postId ? await m.update.mutateAsync({ id: postId, body }) : await m.create.mutateAsync(body);
      const next = { ...f, slug: saved?.slug ?? f.slug, status: saved?.status ?? f.status, publishLocal: saved?.publishDate !== undefined ? toSpInputValue(saved.publishDate) : f.publishLocal };
      setForm(next);
      setBaseline(next);
      dirtyRef.current = false;
      clearDraft(postId);
      toast(postId ? "Post salvo" : "Post criado", "success");
      if (!postId && saved?.id) {
        clearDraft(null);
        router.replace(`/admin/blog/${saved.id}`);
      }
    } catch (e) {
      toast(errorMessage(e, "Não foi possível salvar."), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!postId) return;
    try {
      await m.remove.mutateAsync(postId);
      clearDraft(postId);
      dirtyRef.current = false;
      toast("Post excluído", "success");
      router.push("/admin/blog");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const preview = () => {
    if (baseline.status === "PUBLISHED" && !dirty && form.slug) window.open(`/blog/${form.slug}?preview=1`, "_blank", "noopener");
    else setPreviewOpen(true);
  };

  const seoTitle = form.useCustomSeoTitle && form.seoTitle.trim() ? form.seoTitle : form.title;
  const seoDescription = form.useCustomSeoDescription && form.seoDescription.trim() ? form.seoDescription : form.summary;
  const minutes = readingMinutes(stats.words);
  const catTree = categories.data ?? [];
  const safePreviewHtml = useMemo(() => (previewOpen ? DOMPurify.sanitize(form.content, { ADD_TAGS: ["iframe"], ADD_ATTR: ["allowfullscreen", "frameborder", "target", "data-align"] }) : ""), [previewOpen, form.content]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/blog" className="btn-ghost px-2" aria-label="Voltar para posts">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="mr-auto text-2xl font-bold tracking-tight">{postId ? "Editar post" : "Novo post"}</h1>
        {postId && <Badge tone={BLOG_STATUS_TONE[baseline.status]}>{BLOG_STATUS_LABEL[baseline.status]}</Badge>}
        {dirty ? <span className="text-xs text-amber-600">Alterações não salvas</span> : postId && <span className="text-xs text-[var(--muted)]">Tudo salvo</span>}
        <Button type="button" variant="secondary" onClick={preview}>
          <Eye className="h-4 w-4" /> Pré-visualizar
        </Button>
        {postId && (
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Excluir post">
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        )}
        <Button type="button" onClick={() => save()} loading={saving}>
          <Save className="h-4 w-4" /> Salvar
        </Button>
      </div>

      {draft && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-100">
          <History className="h-4 w-4 shrink-0" aria-hidden />
          <span className="mr-auto">Há um rascunho local não salvo de {fmtSpDateTime(draft.savedAt)}.</span>
          <Button
            type="button"
            variant="secondary"
            className="py-1.5"
            onClick={() => {
              setForm(draft.form);
              setEditorKey((k) => k + 1);
              setDraft(null);
            }}
          >
            Restaurar rascunho
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="py-1.5"
            onClick={() => {
              clearDraft(postId);
              setDraft(null);
            }}
          >
            Descartar
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="space-y-4">
              <div>
                <Input id="post-title" label="Título" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} placeholder="Título do post" className="text-lg font-semibold" />
                <p className="mt-1 text-right text-xs text-[var(--muted)]">{form.title.length} caracteres</p>
              </div>
              <SlugInput key={postId ?? "new"} value={form.slug} title={form.title} onChange={(s) => set("slug", s)} initiallyManual={!!post?.slug} baseUrl={baseUrl} published={baseline.status === "PUBLISHED"} />
              <div>
                <Textarea id="post-summary" label="Resumo (chamada)" value={form.summary} onChange={(e) => set("summary", e.target.value)} maxLength={SUMMARY_MAX} placeholder="Texto curto exibido nas listagens e usado como descrição SEO padrão." />
                <p className={cn("mt-1 text-right text-xs", form.summary.length > SUMMARY_MAX ? "text-red-600" : "text-[var(--muted)]")}>
                  {form.summary.length}/{SUMMARY_MAX}
                </p>
              </div>
            </div>
          </Card>
          <BlogEditor key={editorKey} value={form.content} onChange={(html) => set("content", html)} onStats={setStats} />
          <p className="text-xs text-[var(--muted)]">
            {stats.words} palavras · {stats.characters} caracteres · leitura de ~{minutes} min
          </p>
        </div>

        <aside className="space-y-4">
          <Card title="Publicação">
            <div className="space-y-3">
              <Select id="post-status" label="Status" value={form.status} onChange={(e) => {
                  const status = e.target.value as BlogPostStatus;
                  // Publishing now: drop a future (scheduled) date so the post goes live immediately.
                  const iso = fromSpInputValue(form.publishLocal);
                  setForm((f) => ({ ...f, status, publishLocal: status === "PUBLISHED" && iso && new Date(iso).getTime() > Date.now() ? "" : f.publishLocal }));
                }}>
                {(Object.keys(BLOG_STATUS_LABEL) as BlogPostStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {BLOG_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
              {(form.status === "SCHEDULED" || form.status === "PUBLISHED") && (
                <div>
                  <Input
                    id="post-publish"
                    type="datetime-local"
                    label={form.status === "SCHEDULED" ? "Publicar em (horário de Brasília)" : "Data de publicação (opcional)"}
                    value={form.publishLocal}
                    min={form.status === "SCHEDULED" ? toSpInputValue(new Date().toISOString()) : undefined}
                    onChange={(e) => set("publishLocal", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-[var(--muted)]">{form.status === "PUBLISHED" ? "Vazio = agora." : `Fuso ${BLOG_TZ}. Precisa ser no futuro.`}</p>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Destaque</span>
                <Switch checked={form.featured} onChange={(v) => set("featured", v)} label="Post em destaque" />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Comentários habilitados</span>
                <Switch checked={form.commentsEnabled} onChange={(v) => set("commentsEnabled", v)} label="Comentários habilitados" />
              </div>
              <Button type="button" className="w-full" onClick={() => save()} loading={saving}>
                {form.status === "PUBLISHED" && baseline.status !== "PUBLISHED" ? "Publicar" : form.status === "SCHEDULED" ? "Agendar" : "Salvar"}
              </Button>
            </div>
          </Card>

          <Card title="Categorias">
            {categories.error && isApiMissing(categories.error) ? <ApiNotice /> : <CategoryTreePicker tree={catTree} value={form.categoryIds} onChange={(ids) => set("categoryIds", ids)} />}
          </Card>

          <Card title="Tags">
            <TagsInput value={form.tags} onChange={(t) => set("tags", t)} />
          </Card>

          <Card title="Capas">
            <div className="space-y-4">
              <CropUploader preset={CROP_PRESETS.rect} label="Capa 16:9 (1920×1080)" value={form.coverImageRect} alt={form.coverAlt} onChange={(url) => set("coverImageRect", url)} />
              <CropUploader preset={CROP_PRESETS.square} label="Capa quadrada 1:1 (1080×1080)" value={form.coverImageSquare} alt={form.coverAlt} onChange={(url) => set("coverImageSquare", url)} />
              <CropUploader preset={CROP_PRESETS.og} label="Compartilhamento / OG (1200×630, PNG)" value={form.coverOgImage} alt={form.coverAlt} onChange={(url) => set("coverOgImage", url)} />
              <Input id="post-cover-alt" label="Texto alternativo das capas" value={form.coverAlt} onChange={(e) => set("coverAlt", e.target.value)} maxLength={300} placeholder="Descreva a imagem" />
            </div>
          </Card>

          <Card title="SEO">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-500" checked={form.useCustomSeoTitle} onChange={(e) => setForm((f) => ({ ...f, useCustomSeoTitle: e.target.checked, seoTitle: e.target.checked ? f.seoTitle : "" }))} />
                Título SEO personalizado
              </label>
              {form.useCustomSeoTitle && (
                <div className="border-l-2 pl-3">
                  <Input id="post-seo-title" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={SEO_TITLE_MAX} placeholder="Título para buscadores (máx. 60)" />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-500" checked={form.useCustomSeoDescription} onChange={(e) => setForm((f) => ({ ...f, useCustomSeoDescription: e.target.checked, seoDescription: e.target.checked ? f.seoDescription : "" }))} />
                Descrição SEO personalizada
              </label>
              {form.useCustomSeoDescription && (
                <div className="border-l-2 pl-3">
                  <Textarea id="post-seo-desc" value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={SEO_DESCRIPTION_MAX} placeholder="Descrição para buscadores (máx. 180)" className="min-h-[70px]" />
                </div>
              )}
              <p className="text-xs text-[var(--muted)]">Sem personalização, usamos o título e o resumo.</p>
              <SeoPreview title={seoTitle} description={seoDescription} url={`${baseUrl}/blog/${form.slug}`} />
            </div>
          </Card>
        </aside>
      </div>

      <Drawer open={previewOpen} onClose={() => setPreviewOpen(false)} title="Pré-visualização" wide>
        <article className="mx-auto max-w-2xl">
          {form.coverImageRect && <img src={form.coverImageRect} alt={form.coverAlt} className="mb-4 aspect-video w-full rounded-2xl object-cover" />}
          <h1 className="text-3xl font-bold leading-tight">{form.title || "Sem título"}</h1>
          {form.summary && <p className="mt-2 text-lg text-[var(--muted)]">{form.summary}</p>}
          <p className="mt-2 text-xs text-[var(--muted)]">Leitura de ~{minutes} min</p>
          <div className="tp-prose mt-6" dangerouslySetInnerHTML={{ __html: safePreviewHtml }} />
          {baseline.status !== "PUBLISHED" && <p className="mt-8 rounded-xl bg-ink-100 p-3 text-xs text-[var(--muted)] dark:bg-ink-800">Pré-visualização local. O link público só funciona depois de publicar.</p>}
        </article>
      </Drawer>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} danger title="Excluir post?" description="O post sai do blog e da lista (exclusão lógica)." confirmLabel="Excluir" loading={m.remove.isPending} />
    </div>
  );
}
