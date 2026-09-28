import { prisma } from "@tinypet/db";
import { uploadRequestSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, requirePartner, createUploadTarget, getLimits, storageUsed, rateLimit, Errors } from "@/server";

/**
 * Step 1 of upload: validates and returns a presigned AWS S3 URL or the local upload endpoint.
 * Partner purposes (logo, venue, catalog, course) need X-Partner-Id. Owner purposes check the owner plan.
 */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`upload:${user.id}`, 60, 10 * 60 * 1000);
  const body = await parseBody(req, uploadRequestSchema);
  const partnerPurposes = ["PARTNER_LOGO", "VENUE_PHOTO", "CATALOG", "COURSE"];
  let partnerId: string | undefined;
  if (partnerPurposes.includes(body.purpose) || req.headers.get("x-partner-id")) {
    const ctx = await requirePartner(req);
    partnerId = ctx.partnerId;
    const { limits, planKey } = await getLimits("PARTNER", partnerId);
    const cap = limits.storage_mb;
    if (cap?.quantity != null) {
      const used = await storageUsed({ partnerId });
      if (used + body.sizeBytes > cap.quantity * 1024 * 1024) throw Errors.planLimit({ featureKey: "storage_mb", current: Math.round(used / 1024 / 1024), limit: cap.quantity, planKey });
    }
  } else {
    const { limits, planKey } = await getLimits("OWNER", user.id);
    if (body.purpose === "PET_GALLERY" && !limits.owner_gallery?.enabled) throw Errors.planLimit({ featureKey: "owner_gallery", current: 0, limit: 0, planKey });
    const cap = limits.owner_storage_mb;
    if (cap?.quantity != null) {
      const used = await storageUsed({ userId: user.id });
      if (used + body.sizeBytes > cap.quantity * 1024 * 1024) throw Errors.planLimit({ featureKey: "owner_storage_mb", current: Math.round(used / 1024 / 1024), limit: cap.quantity, planKey });
    }
  }
  if (body.mimeType.startsWith("video/") && body.width && body.height) {
    const ratio = body.width / body.height;
    const okRatio = Math.abs(ratio - 16 / 9) / (16 / 9) <= 0.02 || Math.abs(ratio - 9 / 16) / (9 / 16) <= 0.02;
    if (!okRatio) throw Errors.badRequest("Vídeo precisa ser 16:9 ou 9:16");
  }
  const target = await createUploadTarget({ ...body, userId: partnerId ? undefined : user.id, partnerId });
  await prisma.mediaAsset.update({ where: { id: target.assetId }, data: { width: body.width, height: body.height } });
  return ok(target, { status: 201 });
});
