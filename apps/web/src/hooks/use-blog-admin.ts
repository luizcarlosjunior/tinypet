"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiList, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import type { BlogMediaItem } from "@/lib/blog-media";
import { normalizeTags } from "@/lib/blog-utils";

/* ───────── types (docs/blog-contract.md) ───────── */
export type BlogPostStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export const BLOG_STATUS_LABEL: Record<BlogPostStatus, string> = { DRAFT: "Rascunho", SCHEDULED: "Agendado", PUBLISHED: "Publicado", ARCHIVED: "Arquivado" };
export const BLOG_STATUS_TONE: Record<BlogPostStatus, "gray" | "amber" | "green" | "red"> = { DRAFT: "gray", SCHEDULED: "amber", PUBLISHED: "green", ARCHIVED: "red" };

export type BlogCategoryNode = { id: string; name: string; slug: string; description?: string | null; sortOrder: number; active: boolean; postCount?: number; parentId?: string | null; children: BlogCategoryNode[] };
export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  status: BlogPostStatus;
  publishDate: string | null;
  author?: { id: string; name: string } | null;
  categories?: { id: string; name: string; parentId?: string | null }[];
  views?: number;
  heartsCount?: number;
  commentsCount?: number;
  coverImageRect?: string | null;
  updatedAt?: string;
};
export type BlogPostFull = BlogPostRow & {
  summary?: string | null;
  content: string;
  categoryIds?: string[];
  tags?: string[] | string | null;
  coverImageSquare?: string | null;
  coverOgImage?: string | null;
  coverAlt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  featured?: boolean;
  commentsEnabled?: boolean;
  readingMinutes?: number;
};
export type BlogPostInput = {
  title: string;
  slug?: string;
  summary?: string | null;
  content: string;
  status: BlogPostStatus;
  publishDate?: string | null;
  categoryIds: string[];
  tags?: string[];
  coverImageRect?: string | null;
  coverImageSquare?: string | null;
  coverOgImage?: string | null;
  coverAlt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  featured?: boolean;
  commentsEnabled?: boolean;
};
export type BlogStatsPeriod = "7d" | "30d" | "90d" | "12m" | "custom";
export type BlogStats = {
  totals: { views: number; visitors: number; hearts: number; comments: number; published: number };
  series: { bucket: string; views: number; visitors: number; published: number }[];
  topPosts: { id: string; title: string; slug: string; views: number; hearts: number; comments: number }[];
  byCategory: { id: string; name: string; views: number }[];
  referrers: { host: string; views: number }[];
  devices: { device: string; views: number }[];
};
export type BlogCommentStatus = "VISIBLE" | "HIDDEN" | "DELETED";
export type BlogCommentRow = {
  id: string;
  body: string;
  status: BlogCommentStatus | string;
  createdAt: string;
  post?: { id: string; title: string; slug: string } | null;
  user?: { id: string; name: string; username?: string | null; email?: string | null } | null;
  heartsCount?: number;
  reportsOpen?: number;
  parentId?: string | null;
};
export type BlogCommentAction = "HIDE" | "RESTORE" | "DELETE" | "DISMISS_REPORTS";
export type BlogMediaUsage = { postId: string; title: string; field: "content" | "coverImageRect" | "coverImageSquare" | "coverOgImage" };
export type ListMeta = { page: number; pageSize: number; total: number };

type Params = Record<string, string | number | boolean | undefined | null>;
function qs(params?: Params) {
  if (!params) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, v === true ? "1" : String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
function unwrapList<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const o = d as { items?: T[]; data?: T[] };
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}
async function list<T>(path: string, params?: Params): Promise<{ items: T[]; meta?: ListMeta }> {
  const res = await apiList<unknown>(`/admin/blog/${path}${qs(params)}`, { partnerId: null });
  return { items: unwrapList<T>(res.data), meta: res.meta };
}
const call = <T>(path: string, init?: RequestInit & { json?: unknown }) => api<T>(`/admin/blog/${path}`, { ...init, partnerId: null });

/** Don't hammer endpoints that aren't deployed yet (404) or forbidden. */
const retry = (count: number, e: unknown) => !(e instanceof ApiClientError && [401, 403, 404].includes(e.status)) && count < 2;

export function normalizePost(p: BlogPostFull): BlogPostFull & { tags: string[]; categoryIds: string[] } {
  return { ...p, tags: normalizeTags(p.tags ?? []), categoryIds: p.categoryIds ?? (p.categories ?? []).map((c) => c.id) };
}

/* ───────── categories ───────── */
export function useBlogCategories() {
  return useQuery({ queryKey: ["blog-admin", "categories"], queryFn: async () => unwrapList<BlogCategoryNode>(await call<unknown>("categories")), retry });
}
export function useBlogCategoryMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const done = (msg: string) => () => {
    qc.invalidateQueries({ queryKey: ["blog-admin", "categories"] });
    toast(msg, "success");
  };
  const onError = (e: unknown) => toast(errorMessage(e), "error");
  return {
    create: useMutation({ mutationFn: (body: Partial<BlogCategoryNode>) => call("categories", { method: "POST", json: body }), onSuccess: done("Categoria criada"), onError }),
    update: useMutation({ mutationFn: ({ id, body, silent }: { id: string; body: Partial<BlogCategoryNode>; silent?: boolean }) => call(`categories/${id}`, { method: "PATCH", json: body }).then((r) => ({ r, silent })), onSuccess: (x) => (x.silent ? qc.invalidateQueries({ queryKey: ["blog-admin", "categories"] }) : done("Categoria salva")()), onError }),
    remove: useMutation({ mutationFn: ({ id, force }: { id: string; force?: boolean }) => call(`categories/${id}${force ? "?force=1" : ""}`, { method: "DELETE" }), onSuccess: done("Categoria removida") }),
  };
}

/* ───────── posts ───────── */
export function useBlogPosts(params: { q?: string; status?: string; categoryId?: string; authorId?: string; page?: number; pageSize?: number }) {
  return useQuery({ queryKey: ["blog-admin", "posts", params], queryFn: () => list<BlogPostRow>("posts", params), placeholderData: keepPreviousData, retry });
}
export function useBlogPost(id: string | null | undefined) {
  return useQuery({ queryKey: ["blog-admin", "post", id], queryFn: async () => normalizePost(await call<BlogPostFull>(`posts/${id}`)), enabled: !!id, retry, staleTime: Infinity, refetchOnWindowFocus: false });
}
export function useBlogPostMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["blog-admin", "posts"] });
  return {
    create: useMutation({ mutationFn: (body: BlogPostInput) => call<BlogPostFull>("posts", { method: "POST", json: body }), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<BlogPostInput> }) => call<BlogPostFull>(`posts/${id}`, { method: "PATCH", json: body }),
      onSuccess: (p, v) => {
        invalidate();
        if (p && typeof p === "object" && "id" in p) qc.setQueryData(["blog-admin", "post", v.id], normalizePost(p));
      },
    }),
    remove: useMutation({ mutationFn: (id: string) => call(`posts/${id}`, { method: "DELETE" }), onSuccess: invalidate }),
  };
}

/* ───────── media ───────── */
export function useBlogMedia(params: { q?: string; type?: string; inUse?: string; trash?: boolean; page?: number; pageSize?: number }, enabled = true) {
  return useQuery({ queryKey: ["blog-admin", "media", params], queryFn: () => list<BlogMediaItem>("media", params), placeholderData: keepPreviousData, enabled, retry });
}
export function useBlogMediaUsage(id: string | null) {
  return useQuery({ queryKey: ["blog-admin", "media-usage", id], queryFn: async () => unwrapList<BlogMediaUsage>(await call<unknown>(`media/${id}/usage`)), enabled: !!id, retry });
}
export function useBlogMediaMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["blog-admin", "media"] });
  return {
    invalidate,
    updateAlt: useMutation({ mutationFn: ({ id, alt }: { id: string; alt: string }) => call(`media/${id}`, { method: "PATCH", json: { alt } }), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: ({ id, force }: { id: string; force?: boolean }) => call(`media/${id}${force ? "?force=1" : ""}`, { method: "DELETE" }), onSuccess: invalidate }),
    restore: useMutation({ mutationFn: (id: string) => call(`media/${id}/restore`, { method: "POST" }), onSuccess: invalidate }),
  };
}

/* ───────── stats ───────── */
export function useBlogStats(params: { period: BlogStatsPeriod; from?: string; to?: string; postId?: string; categoryId?: string }, enabled = true) {
  return useQuery({ queryKey: ["blog-admin", "stats", params], queryFn: () => call<BlogStats>(`stats${qs(params)}`), enabled, retry, placeholderData: keepPreviousData });
}

/* ───────── comments ───────── */
export function useBlogComments(params: { status?: string; postId?: string; reported?: boolean; page?: number }) {
  return useQuery({ queryKey: ["blog-admin", "comments", params], queryFn: () => list<BlogCommentRow>("comments", params), placeholderData: keepPreviousData, retry });
}
export function useModerateComment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const labels: Record<BlogCommentAction, string> = { HIDE: "Comentário ocultado", RESTORE: "Comentário restaurado", DELETE: "Comentário excluído", DISMISS_REPORTS: "Denúncias descartadas" };
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: BlogCommentAction }) => call(`comments/${id}`, { method: "POST", json: { action } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["blog-admin", "comments"] });
      toast(labels[v.action], "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
}

/** Flattens the category tree to `[{ node, depth }]`. */
export function flattenCategories(tree: BlogCategoryNode[], depth = 0, out: { node: BlogCategoryNode; depth: number; parentId: string | null }[] = [], parentId: string | null = null) {
  for (const n of [...tree].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
    out.push({ node: n, depth, parentId });
    if (n.children?.length) flattenCategories(n.children, depth + 1, out, n.id);
  }
  return out;
}
