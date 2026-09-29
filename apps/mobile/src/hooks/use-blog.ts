import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { ApiError, api, apiList, errorMessage, qs } from "@/lib/api";
import type { BlogCategory, BlogComment, BlogCommentsPage, BlogHeartResult, BlogPostResponse, BlogPostSummary } from "@/lib/types";

// Blog endpoints are account-level (never partner-scoped): always send `partnerId: null`.
const NO_PARTNER = { partnerId: null } as const;
const PAGE_SIZE = 10;
const COMMENTS_LIMIT = 20;

export const blogKeys = {
  all: ["blog"] as const,
  categories: ["blog", "categories"] as const,
  posts: (f: BlogPostFilters) => ["blog", "posts", f] as const,
  latest: (n: number) => ["blog", "latest", n] as const,
  post: (slug: string | undefined) => ["blog", "post", slug] as const,
  comments: (postId: string | undefined) => ["blog", "comments", postId] as const,
};

export type BlogPostFilters = { category?: string; tag?: string; q?: string };

/** pt-BR message for blog API errors (429 rate limit, 403 comments disabled, 401 login). */
export function blogErrorMessage(e: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return "Você fez muitas ações em pouco tempo. Aguarde um instante e tente novamente.";
    if (e.status === 403) return e.message || "Você não tem permissão para esta ação.";
    if (e.status === 401) return "Entre na sua conta para continuar.";
    if (e.status === 404) return "Conteúdo não encontrado. Ele pode ter sido removido.";
  }
  return errorMessage(e, fallback);
}

export function useBlogCategories() {
  return useQuery({ queryKey: blogKeys.categories, queryFn: () => api<BlogCategory[]>("/blog/categories", NO_PARTNER), staleTime: 5 * 60_000 });
}

export function useBlogPosts(filters: BlogPostFilters) {
  return useInfiniteQuery({
    queryKey: blogKeys.posts(filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => apiList<BlogPostSummary[]>(`/blog/posts${qs({ ...filters, page: pageParam, pageSize: PAGE_SIZE })}`, NO_PARTNER),
    getNextPageParam: (last, _all, page) => {
      const n = last.data?.length ?? 0;
      if (last.meta) return last.meta.page * last.meta.pageSize < last.meta.total ? page + 1 : undefined;
      return n >= PAGE_SIZE ? page + 1 : undefined;
    },
  });
}

/** Latest N posts for the home "Do blog" section. */
export function useLatestBlogPosts(n = 3) {
  return useQuery({ queryKey: blogKeys.latest(n), queryFn: () => api<BlogPostSummary[]>(`/blog/posts${qs({ page: 1, pageSize: n })}`, NO_PARTNER), staleTime: 5 * 60_000 });
}

export function useBlogPost(slug: string | undefined) {
  return useQuery({ queryKey: blogKeys.post(slug), queryFn: () => api<BlogPostResponse>(`/blog/posts/${encodeURIComponent(slug!)}`, NO_PARTNER), enabled: !!slug });
}

/** View beacon (fire-and-forget). Returns false when the API rejected it (e.g. the same-origin check). */
export async function sendBlogView(postId: string, screen: { width: number; height: number }): Promise<boolean> {
  try {
    await api(`/blog/posts/${postId}/view`, { method: "POST", json: { screenWidth: Math.round(screen.width), screenHeight: Math.round(screen.height) }, ...NO_PARTNER });
    return true;
  } catch (e) {
    if (__DEV__) console.warn("[blog] view beacon rejected:", e instanceof ApiError ? `${e.status} ${e.code} ${e.message}` : e);
    return false;
  }
}

type PostCache = BlogPostResponse | undefined;

export function usePostHeart(slug: string | undefined) {
  const qc = useQueryClient();
  const key = blogKeys.post(slug);
  const patch = (fn: (p: { viewerHearted?: boolean; heartsCount?: number }) => { viewerHearted: boolean; heartsCount: number }) =>
    qc.setQueryData<PostCache>(key, (old) => (old && "id" in old ? { ...old, ...fn(old) } : old));
  return useMutation({
    mutationFn: (postId: string) => api<BlogHeartResult>(`/blog/posts/${postId}/heart`, { method: "POST", ...NO_PARTNER }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PostCache>(key);
      patch((p) => ({ viewerHearted: !p.viewerHearted, heartsCount: Math.max(0, (p.heartsCount ?? 0) + (p.viewerHearted ? -1 : 1)) }));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSuccess: (r) => patch(() => ({ viewerHearted: r.hearted, heartsCount: r.heartsCount })),
  });
}

// ───────────── Comments ─────────────

export function useBlogComments(postId: string | undefined) {
  return useInfiniteQuery({
    queryKey: blogKeys.comments(postId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api<BlogCommentsPage>(`/blog/posts/${postId}/comments${qs({ cursor: pageParam, limit: COMMENTS_LIMIT })}`, NO_PARTNER),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!postId,
  });
}

type CommentsData = InfiniteData<BlogCommentsPage, string | null>;

function mapComments(qc: QueryClient, postId: string, fn: (c: BlogComment) => BlogComment | null) {
  qc.setQueryData<CommentsData>(blogKeys.comments(postId), (old) => {
    if (!old) return old;
    const apply = (list: BlogComment[]): BlogComment[] =>
      list.flatMap((c) => {
        const next = fn(c);
        if (!next) return [];
        return [next.replies ? { ...next, replies: apply(next.replies) } : next];
      });
    return { ...old, pages: old.pages.map((p) => ({ ...p, items: apply(p.items) })) };
  });
}

/** Invalidate the thread and the post (commentsCount). */
function refreshThread(qc: QueryClient, postId: string) {
  qc.invalidateQueries({ queryKey: blogKeys.comments(postId) });
  qc.invalidateQueries({ queryKey: ["blog", "post"] });
}

export function useCreateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; parentId?: string | null }) => api<BlogComment>(`/blog/posts/${postId}/comments`, { method: "POST", json: { body: input.body.trim(), parentId: input.parentId ?? undefined }, ...NO_PARTNER }),
    onSuccess: () => refreshThread(qc, postId),
  });
}

export function useUpdateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api<BlogComment>(`/blog/comments/${id}`, { method: "PATCH", json: { body: body.trim() }, ...NO_PARTNER }),
    onSuccess: (updated, v) => {
      mapComments(qc, postId, (c) => (c.id === v.id ? { ...c, body: updated?.body ?? v.body.trim(), editedAt: updated?.editedAt ?? new Date().toISOString() } : c));
      qc.invalidateQueries({ queryKey: blogKeys.comments(postId) });
    },
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/blog/comments/${id}`, { method: "DELETE", ...NO_PARTNER }),
    onSuccess: (_d, id) => {
      mapComments(qc, postId, (c) => (c.id === id ? null : c));
      refreshThread(qc, postId);
    },
  });
}

export function useCommentHeart(postId: string) {
  const qc = useQueryClient();
  const key = blogKeys.comments(postId);
  return useMutation({
    mutationFn: (commentId: string) => api<BlogHeartResult>(`/blog/comments/${commentId}/heart`, { method: "POST", ...NO_PARTNER }),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CommentsData>(key);
      mapComments(qc, postId, (c) => (c.id === commentId ? { ...c, viewerHearted: !c.viewerHearted, heartsCount: Math.max(0, c.heartsCount + (c.viewerHearted ? -1 : 1)) } : c));
      return { prev };
    },
    onError: (_e, _id, ctx) => qc.setQueryData(key, ctx?.prev),
    onSuccess: (r, commentId) => mapComments(qc, postId, (c) => (c.id === commentId ? { ...c, viewerHearted: r.hearted, heartsCount: r.heartsCount } : c)),
  });
}

export function useReportComment() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api(`/blog/comments/${id}/report`, { method: "POST", json: { reason: reason.trim().slice(0, 500) }, ...NO_PARTNER }),
  });
}
