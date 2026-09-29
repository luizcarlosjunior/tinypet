import { z } from "zod";
import { prisma, Prisma } from "@tinypet/db";
import { Errors } from "../errors";
import { paginate, rateLimit } from "../api";
import { notify } from "../notify";
import type { AuthUser } from "../auth";
import { isBlogEditor } from "./auth";
import { findPublishedPost } from "./posts";
import { COMMENT_MAX, commentBodyError, normalizeCommentBody } from "./text";

export const commentCreateSchema = z.object({ body: z.string().max(COMMENT_MAX * 2), parentId: z.string().min(1).optional().nullable() });
export const commentPatchSchema = z.object({ body: z.string().max(COMMENT_MAX * 2) });
export const commentReportSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const commentListSchema = z.object({ cursor: z.string().max(40).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
export const adminCommentListSchema = z.object({
  status: z.enum(["VISIBLE", "HIDDEN"]).optional(),
  postId: z.string().optional(),
  reported: z.enum(["0", "1"]).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const commentModerationSchema = z.object({ action: z.enum(["HIDE", "RESTORE", "DELETE", "DISMISS_REPORTS"]) });

/** Validated, normalized comment body (400 with a pt-BR message otherwise). */
export function validCommentBody(raw: string): string {
  const body = normalizeCommentBody(raw);
  const err = commentBodyError(body);
  if (err) throw Errors.badRequest(err, { field: "body" });
  return body;
}

/** Recounts VISIBLE, non-deleted comments (replies only count while their parent is visible). */
export async function recountComments(postId: string) {
  const visible = { status: "VISIBLE" as const, deletedAt: null };
  const commentsCount = await prisma.blogComment.count({ where: { postId, ...visible, OR: [{ parentId: null }, { parent: visible }] } });
  await prisma.blogPost.update({ where: { id: postId }, data: { commentsCount } });
  return commentsCount;
}

const userSelect = { id: true, name: true, username: true, avatarUrl: true } satisfies Prisma.UserSelect;
const commentSelect = (viewerId: string | null) =>
  ({
    id: true,
    body: true,
    createdAt: true,
    editedAt: true,
    heartsCount: true,
    parentId: true,
    userId: true,
    user: { select: userSelect },
    hearts: { where: { userId: viewerId ?? "__none__" }, select: { userId: true } },
  }) satisfies Prisma.BlogCommentSelect;

type CommentRow = Prisma.BlogCommentGetPayload<{ select: ReturnType<typeof commentSelect> }>;

export type CommentItem = {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  parentId: string | null;
  user: { id: string; name: string; username: string | null; avatarUrl: string | null };
  heartsCount: number;
  viewerHearted: boolean;
  canEdit: boolean;
  canDelete: boolean;
  replies?: CommentItem[];
};

function toItem(r: CommentRow, viewer: Pick<AuthUser, "id" | "role"> | null): CommentItem {
  const mine = !!viewer && r.userId === viewer.id;
  return {
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    editedAt: r.editedAt,
    parentId: r.parentId,
    user: r.user,
    heartsCount: r.heartsCount,
    viewerHearted: r.hearts.length > 0,
    canEdit: mine,
    canDelete: mine || isBlogEditor(viewer),
  };
}

const MAX_REPLIES = 100;

/** Top-level VISIBLE comments newest first (cursor = last id), each with VISIBLE replies oldest first. */
export async function listComments(postId: string, q: z.infer<typeof commentListSchema>, viewer: Pick<AuthUser, "id" | "role"> | null) {
  const post = await findPublishedPost(postId);
  if (!post) throw Errors.notFound("Post não encontrado");
  const visible = { status: "VISIBLE" as const, deletedAt: null };
  const rows = await prisma.blogComment.findMany({
    where: { postId, parentId: null, ...visible },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    select: { ...commentSelect(viewer?.id ?? null), replies: { where: visible, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: MAX_REPLIES, select: commentSelect(viewer?.id ?? null) } },
  });
  const page = rows.slice(0, q.limit);
  return {
    items: page.map((r) => ({ ...toItem(r, viewer), replies: r.replies.map((x) => toItem(x, viewer)) })),
    nextCursor: rows.length > q.limit ? page[page.length - 1]!.id : null,
    commentsEnabled: post.commentsEnabled,
  };
}

export async function createComment(postId: string, input: z.infer<typeof commentCreateSchema>, user: AuthUser) {
  const body = validCommentBody(input.body);
  const post = await findPublishedPost(postId);
  if (!post) throw Errors.notFound("Post não encontrado");
  if (!post.commentsEnabled) throw Errors.forbidden("Os comentários estão desativados neste post");
  let parent: { id: string; userId: string } | null = null;
  if (input.parentId) {
    parent = await prisma.blogComment.findFirst({ where: { id: input.parentId, postId, parentId: null, status: "VISIBLE", deletedAt: null }, select: { id: true, userId: true } });
    if (!parent) throw Errors.badRequest("Só é possível responder a um comentário principal deste post", { field: "parentId" });
  }
  await rateLimit(`blog:comment:min:${user.id}`, 5, 60_000);
  await rateLimit(`blog:comment:day:${user.id}`, 50, 86_400_000);
  const c = await prisma.blogComment.create({ data: { postId, userId: user.id, parentId: parent?.id ?? null, body }, select: commentSelect(user.id) });
  await recountComments(postId);
  if (parent && parent.userId !== user.id) {
    const snippet = body.length > 140 ? `${body.slice(0, 137)}…` : body;
    await notify({
      userId: parent.userId,
      type: "blog_comment_reply",
      title: `${user.name} respondeu seu comentário`,
      body: `Em “${post.title}”: ${snippet}`,
      data: { route: `/blog/${post.slug}`, postId, commentId: c.id, parentId: parent.id },
    }).catch((e) => console.warn("[blog] reply notification failed", e));
  }
  return { ...toItem(c, user), replies: parent ? undefined : [] };
}

async function loadComment(id: string) {
  const c = await prisma.blogComment.findFirst({ where: { id, deletedAt: null }, select: { id: true, userId: true, postId: true, status: true, parentId: true } });
  if (!c) throw Errors.notFound("Comentário não encontrado");
  return c;
}

export async function editComment(id: string, rawBody: string, user: AuthUser) {
  const c = await loadComment(id);
  if (c.userId !== user.id) throw Errors.forbidden("Apenas o autor pode editar o comentário");
  const body = validCommentBody(rawBody);
  await rateLimit(`blog:comment:edit:${user.id}`, 20, 60_000);
  const updated = await prisma.blogComment.update({ where: { id }, data: { body, editedAt: new Date() }, select: commentSelect(user.id) });
  return toItem(updated, user);
}

export async function deleteComment(id: string, user: AuthUser) {
  const c = await loadComment(id);
  if (c.userId !== user.id && !isBlogEditor(user)) throw Errors.forbidden("Sem permissão para excluir este comentário");
  await prisma.blogComment.update({ where: { id }, data: { deletedAt: new Date() } });
  await recountComments(c.postId);
  return { id, deleted: true };
}

export async function reportComment(id: string, reason: string, user: AuthUser) {
  const c = await loadComment(id);
  if (c.status !== "VISIBLE") throw Errors.notFound("Comentário não encontrado");
  if (c.userId === user.id) throw Errors.badRequest("Você não pode denunciar o próprio comentário");
  await rateLimit(`blog:comment:report:${user.id}`, 20, 3_600_000);
  try {
    await prisma.blogCommentReport.create({ data: { commentId: id, userId: user.id, reason } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw Errors.conflict("Você já denunciou este comentário");
    throw e;
  }
  return { reported: true };
}

// ───────────────────────────── moderation ─────────────────────────────

export async function listAdminComments(q: z.infer<typeof adminCommentListSchema>) {
  const where: Prisma.BlogCommentWhereInput = {
    deletedAt: null,
    ...(q.status ? { status: q.status } : {}),
    ...(q.postId ? { postId: q.postId } : {}),
    ...(q.reported === "1" ? { reports: { some: { status: "OPEN" } } } : {}),
    ...(q.q ? { body: { contains: q.q } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.blogComment.count({ where }),
    prisma.blogComment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...paginate(q.page, q.pageSize),
      select: {
        id: true,
        body: true,
        status: true,
        createdAt: true,
        editedAt: true,
        parentId: true,
        heartsCount: true,
        post: { select: { id: true, title: true, slug: true } },
        user: { select: { id: true, name: true, username: true, email: true } },
        reports: { where: { status: "OPEN" }, select: { id: true, reason: true, createdAt: true, user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
        _count: { select: { reports: { where: { status: "OPEN" } } } },
      },
    }),
  ]);
  return {
    items: rows.map(({ _count, reports, ...r }) => ({ ...r, reportsOpen: _count.reports, reports })),
    meta: { page: q.page, pageSize: q.pageSize, total },
  };
}

export async function moderateComment(id: string, action: z.infer<typeof commentModerationSchema>["action"]) {
  const c = await prisma.blogComment.findUnique({ where: { id }, select: { id: true, postId: true } });
  if (!c) throw Errors.notFound("Comentário não encontrado");
  const resolveReports = (status: "RESOLVED" | "DISMISSED") => prisma.blogCommentReport.updateMany({ where: { commentId: id, status: "OPEN" }, data: { status } });
  switch (action) {
    case "HIDE":
      await prisma.$transaction([prisma.blogComment.update({ where: { id }, data: { status: "HIDDEN" } }), resolveReports("RESOLVED")]);
      break;
    case "RESTORE":
      await prisma.blogComment.update({ where: { id }, data: { status: "VISIBLE", deletedAt: null } });
      break;
    case "DELETE":
      await prisma.$transaction([prisma.blogComment.update({ where: { id }, data: { deletedAt: new Date() } }), resolveReports("RESOLVED")]);
      break;
    case "DISMISS_REPORTS":
      await resolveReports("DISMISSED");
      break;
  }
  const commentsCount = await recountComments(c.postId);
  const updated = await prisma.blogComment.findUniqueOrThrow({ where: { id }, select: { id: true, status: true, deletedAt: true, _count: { select: { reports: { where: { status: "OPEN" } } } } } });
  return { id, status: updated.status, deleted: !!updated.deletedAt, reportsOpen: updated._count.reports, commentsCount };
}
