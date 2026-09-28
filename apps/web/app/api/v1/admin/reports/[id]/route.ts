import { prisma } from "@tinypet/db";
import { moderationSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireAdmin, serialize, audit, clientIp, Errors } from "@/server";
import { recomputeItemRating, recomputePartnerRating } from "@/server/ratings";
import { reportInclude } from "@/server/admin";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const r = await prisma.report.findUnique({ where: { id: params.id }, include: reportInclude });
  if (!r) throw Errors.notFound("Denúncia não encontrada");
  return ok(serialize(r));
});

/** POST /admin/reports/:id (moderationSchema): HIDE → review HIDDEN + report RESOLVED · RESTORE → review VISIBLE + RESOLVED · DISMISS → DISMISSED. Ratings recomputed. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { action } = await parseBody(req, moderationSchema);
  const r = await prisma.report.findUnique({ where: { id: params.id }, include: { review: true } });
  if (!r) throw Errors.notFound("Denúncia não encontrada");
  if (r.review && action !== "DISMISS") {
    const status = action === "HIDE" ? "HIDDEN" : "VISIBLE";
    await prisma.review.update({ where: { id: r.review.id }, data: { status } });
    if (r.review.itemId) await recomputeItemRating(r.review.itemId);
    await recomputePartnerRating(r.review.partnerId);
    if (action === "HIDE") await prisma.report.updateMany({ where: { reviewId: r.review.id, status: "OPEN" }, data: { status: "RESOLVED" } });
  } else if (r.mediaAssetId && action === "HIDE") {
    await prisma.mediaAsset.update({ where: { id: r.mediaAssetId }, data: { status: "REJECTED" } });
  }
  await prisma.report.update({ where: { id: r.id }, data: { status: action === "DISMISS" ? "DISMISSED" : "RESOLVED" } });
  await audit({ userId: admin.id, action: `moderation.${action.toLowerCase()}`, entity: "Report", entityId: r.id, data: { reviewId: r.reviewId, mediaAssetId: r.mediaAssetId }, ip: clientIp(req) });
  return ok(serialize(await prisma.report.findUniqueOrThrow({ where: { id: r.id }, include: reportInclude })));
});
