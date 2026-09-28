import { prisma, Prisma } from "@tinypet/db";
import { Errors } from "./errors";
import { notify, notifyPartner } from "./notify";

const COMMUNITY_VOICE_THRESHOLD = 5;

// ───────────────────────────── recompute ─────────────────────────────

/** Mean of VISIBLE reviews for the item. */
export async function recomputeItemRating(itemId: string) {
  const agg = await prisma.review.aggregate({ where: { itemId, status: "VISIBLE" }, _avg: { rating: true }, _count: { _all: true } });
  const count = agg._count._all;
  await prisma.catalogItem.update({ where: { id: itemId }, data: { ratingAvg: count ? Math.round((agg._avg.rating ?? 0) * 100) / 100 : null, ratingCount: count } });
}

/** Weighted mean across the partner's (non-deleted) items, weighted by each item's ratingCount. */
export async function recomputePartnerRating(partnerId: string) {
  const items = await prisma.catalogItem.findMany({ where: { partnerId, deletedAt: null, ratingCount: { gt: 0 } }, select: { ratingAvg: true, ratingCount: true } });
  let weighted = 0;
  let count = 0;
  for (const it of items) {
    weighted += Number(it.ratingAvg ?? 0) * it.ratingCount;
    count += it.ratingCount;
  }
  await prisma.partner.update({ where: { id: partnerId }, data: { ratingAvg: count ? Math.round((weighted / count) * 100) / 100 : null, ratingCount: count } });
}

/** Mean of VISIBLE reviews for the course. */
export async function recomputeCourseRating(courseId: string) {
  const agg = await prisma.review.aggregate({ where: { courseId, status: "VISIBLE" }, _avg: { rating: true }, _count: { _all: true } });
  const count = agg._count._all;
  await prisma.course.update({ where: { id: courseId }, data: { ratingAvg: count ? Math.round((agg._avg.rating ?? 0) * 100) / 100 : null, ratingCount: count } });
}

/** Recomputes whatever the review touches (item + partner, or course). Safe for admin moderation. */
export async function recomputeForReview(review: { itemId: string | null; courseId: string | null; partnerId: string }) {
  if (review.itemId) {
    await recomputeItemRating(review.itemId);
    await recomputePartnerRating(review.partnerId);
  }
  if (review.courseId) await recomputeCourseRating(review.courseId);
}

// ───────────────────────────── helpers ─────────────────────────────

/** "Cliente verificado": COMPLETED appointment or ACTIVE/COMPLETED contract with the partner. */
export async function isVerifiedClient(userId: string, partnerId: string) {
  const [appt, contract] = await Promise.all([
    prisma.appointment.findFirst({ where: { partnerId, status: "COMPLETED", OR: [{ requestedByUserId: userId }, { client: { userId } }] }, select: { id: true } }),
    prisma.contract.findFirst({ where: { partnerId, status: { in: ["ACTIVE", "COMPLETED"] }, client: { userId } }, select: { id: true } }),
  ]);
  return !!(appt || contract);
}

/**
 * Badge "community_voice" (5 published reviews). The badge is per pet in the schema, so it is awarded
 * to the user's first active pet (oldest) once they reach the threshold.
 */
export async function maybeAwardCommunityVoice(userId: string) {
  const count = await prisma.review.count({ where: { userId, status: "VISIBLE" } });
  if (count < COMMUNITY_VOICE_THRESHOLD) return;
  const badge = await prisma.badge.findUnique({ where: { key: "community_voice" } });
  if (!badge) return;
  const pet = await prisma.pet.findFirst({ where: { ownerId: userId, status: "ACTIVE", deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  if (!pet) return;
  const exists = await prisma.earnedBadge.findUnique({ where: { badgeId_petId: { badgeId: badge.id, petId: pet.id } } });
  if (exists) return;
  await prisma.earnedBadge.create({ data: { badgeId: badge.id, petId: pet.id } });
  await notify({ userId, type: "BADGE", title: `Nova badge: ${badge.name}`, body: `${pet.name} conquistou a badge "${badge.name}".`, data: { petId: pet.id, badgeKey: badge.key } });
}

export const reviewInclude = {
  user: { select: { id: true, name: true, avatarUrl: true } },
  reply: true,
  item: { select: { id: true, name: true } },
  course: { select: { id: true, title: true } },
  partner: { select: { id: true, tradeName: true, slug: true } },
} satisfies Prisma.ReviewInclude;

// ───────────────────────────── item / course reviews ─────────────────────────────

/** One review per user per item; upsert (editable). */
export async function upsertItemReview(userId: string, itemId: string, input: { rating: number; comment?: string | null }) {
  const item = await prisma.catalogItem.findFirst({ where: { id: itemId, deletedAt: null, partner: { deletedAt: null } }, select: { id: true, partnerId: true, name: true } });
  if (!item) throw Errors.notFound("Item não encontrado");
  const member = await prisma.membership.findUnique({ where: { userId_partnerId: { userId, partnerId: item.partnerId } } });
  if (member) throw Errors.forbidden("Você não pode avaliar o próprio parceiro");
  const verified = await isVerifiedClient(userId, item.partnerId);
  const existing = await prisma.review.findFirst({ where: { userId, itemId } });
  const review = existing
    ? await prisma.review.update({ where: { id: existing.id }, data: { rating: input.rating, comment: input.comment ?? null, verified }, include: reviewInclude })
    : await prisma.review.create({ data: { userId, partnerId: item.partnerId, itemId, rating: input.rating, comment: input.comment ?? null, verified }, include: reviewInclude });
  await recomputeForReview(review);
  if (!existing) {
    await maybeAwardCommunityVoice(userId);
    await notifyPartner(item.partnerId, { type: "REVIEW", title: "Nova avaliação", body: `${review.user.name} avaliou "${item.name}" com nota ${input.rating}.`, data: { reviewId: review.id, itemId } });
  }
  return review;
}

export async function upsertCourseReview(userId: string, courseId: string, input: { rating: number; comment?: string | null }) {
  const course = await prisma.course.findFirst({ where: { id: courseId, partner: { deletedAt: null } }, select: { id: true, partnerId: true, title: true } });
  if (!course) throw Errors.notFound("Curso não encontrado");
  const enrolled = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId } } });
  if (!enrolled) throw Errors.forbidden("Só alunos matriculados podem avaliar o curso");
  const existing = await prisma.review.findFirst({ where: { userId, courseId } });
  const review = existing
    ? await prisma.review.update({ where: { id: existing.id }, data: { rating: input.rating, comment: input.comment ?? null, verified: true }, include: reviewInclude })
    : await prisma.review.create({ data: { userId, partnerId: course.partnerId, courseId, rating: input.rating, comment: input.comment ?? null, verified: true }, include: reviewInclude });
  await recomputeForReview(review);
  if (!existing) {
    await maybeAwardCommunityVoice(userId);
    await notifyPartner(course.partnerId, { type: "REVIEW", title: "Nova avaliação de curso", body: `${review.user.name} avaliou "${course.title}" com nota ${input.rating}.`, data: { reviewId: review.id, courseId } });
  }
  return review;
}

export async function listMyReviews(userId: string) {
  return prisma.review.findMany({ where: { userId }, include: reviewInclude, orderBy: { createdAt: "desc" } });
}

export async function deleteOwnReview(userId: string, reviewId: string) {
  const review = await prisma.review.findFirst({ where: { id: reviewId, userId } });
  if (!review) throw Errors.notFound("Avaliação não encontrada");
  await prisma.review.delete({ where: { id: reviewId } });
  await recomputeForReview(review);
}

/** Partner member replies once, publicly. */
export async function replyToReview(userId: string, reviewId: string, body: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, include: { reply: true } });
  if (!review) throw Errors.notFound("Avaliação não encontrada");
  const member = await prisma.membership.findUnique({ where: { userId_partnerId: { userId, partnerId: review.partnerId } } });
  if (!member) throw Errors.forbidden("Apenas a equipe do parceiro pode responder");
  if (review.reply) throw Errors.conflict("Esta avaliação já foi respondida");
  const reply = await prisma.reviewReply.create({ data: { reviewId, body } });
  const partner = await prisma.partner.findUnique({ where: { id: review.partnerId }, select: { tradeName: true } });
  await notify({ userId: review.userId, type: "REVIEW_REPLY", title: "Sua avaliação foi respondida", body: `${partner?.tradeName ?? "O parceiro"} respondeu à sua avaliação.`, data: { reviewId } });
  return reply;
}

export async function reportReview(userId: string, reviewId: string, reason: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw Errors.notFound("Avaliação não encontrada");
  const open = await prisma.report.findFirst({ where: { reviewId, reporterId: userId, status: "OPEN" } });
  if (open) throw Errors.conflict("Você já denunciou esta avaliação");
  return prisma.report.create({ data: { reviewId, reporterId: userId, reason } });
}

export async function listPartnerReviews(partnerId: string, page: number, pageSize: number) {
  const where = { partnerId };
  const [items, total] = await Promise.all([
    prisma.review.findMany({ where, include: reviewInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.review.count({ where }),
  ]);
  return { items, total };
}
