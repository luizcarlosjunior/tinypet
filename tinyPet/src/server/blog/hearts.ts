import { prisma } from "@/db";
import { Errors } from "../errors";
import { rateLimit } from "../api";
import { findPublishedPost } from "./posts";

/** Toggles the viewer's heart on a published post; counter updated in the same transaction. */
export async function togglePostHeart(postId: string, userId: string) {
  await rateLimit(`blog:heart:${userId}`, 60, 60_000);
  const post = await findPublishedPost(postId);
  if (!post) throw Errors.notFound("Post não encontrado");
  return prisma.$transaction(async (tx) => {
    const del = await tx.blogPostHeart.deleteMany({ where: { postId, userId } });
    let hearted: boolean;
    if (del.count) {
      await tx.blogPost.updateMany({ where: { id: postId, heartsCount: { gt: 0 } }, data: { heartsCount: { decrement: 1 } } });
      hearted = false;
    } else {
      await tx.blogPostHeart.create({ data: { postId, userId } });
      await tx.blogPost.update({ where: { id: postId }, data: { heartsCount: { increment: 1 } } });
      hearted = true;
    }
    const { heartsCount } = await tx.blogPost.findUniqueOrThrow({ where: { id: postId }, select: { heartsCount: true } });
    return { hearted, heartsCount };
  });
}

/** Toggles the viewer's heart on a VISIBLE comment of a published post. */
export async function toggleCommentHeart(commentId: string, userId: string) {
  await rateLimit(`blog:heart:${userId}`, 60, 60_000);
  const c = await prisma.blogComment.findFirst({ where: { id: commentId, status: "VISIBLE", deletedAt: null }, select: { id: true, postId: true } });
  if (!c || !(await findPublishedPost(c.postId))) throw Errors.notFound("Comentário não encontrado");
  return prisma.$transaction(async (tx) => {
    const del = await tx.blogCommentHeart.deleteMany({ where: { commentId, userId } });
    let hearted: boolean;
    if (del.count) {
      await tx.blogComment.updateMany({ where: { id: commentId, heartsCount: { gt: 0 } }, data: { heartsCount: { decrement: 1 } } });
      hearted = false;
    } else {
      await tx.blogCommentHeart.create({ data: { commentId, userId } });
      await tx.blogComment.update({ where: { id: commentId }, data: { heartsCount: { increment: 1 } } });
      hearted = true;
    }
    const { heartsCount } = await tx.blogComment.findUniqueOrThrow({ where: { id: commentId }, select: { heartsCount: true } });
    return { hearted, heartsCount };
  });
}
