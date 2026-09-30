import { uploadRequestSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, requirePartner, createUploadTarget, assertVideoRequest, assertVideoPlanAllowed, getLimits, storageUsed, rateLimit, featureNotIncluded, clientIp, isAttributableIp, rememberIp, Errors } from "@/server";

/**
 * Step 1 of upload: validates and returns a presigned AWS S3 URL or the local upload endpoint.
 * Partner purposes (logo, venue, catalog, course) need X-Partner-Id. Owner purposes check the owner plan.
 * Videos: only `video/mp4` with width/height 1920x1080, 1280x720, 1080x1920 or 720x1280 and durationSeconds > 0.
 * VIDEO_COVER (image) follows the caller context: with X-Partner-Id it belongs to the partner, else to the user.
 */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`upload:${user.id}`, 60, 10 * 60 * 1000);
  const body = await parseBody(req, uploadRequestSchema);
  // Videos must already be the client-transcoded MP4 (VIDEO_OUTPUT); fail fast with a clear message before quota checks.
  if (body.mimeType.startsWith("video/")) assertVideoRequest(body);
  const partnerPurposes = ["PARTNER_LOGO", "VENUE_PHOTO", "CATALOG", "COURSE"];
  let partnerId: string | undefined;
  if (body.purpose === "PRODUCT_IMAGE") {
    // Platform catalog images (food lines/flavors): admins only, no plan quota.
    if (user.role !== "ADMIN") throw Errors.forbidden("Apenas administradores enviam imagens de produtos");
  } else if (partnerPurposes.includes(body.purpose) || req.headers.get("x-partner-id")) {
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
    if (body.purpose === "PET_GALLERY" && !limits.owner_gallery?.enabled) throw await featureNotIncluded("owner_gallery", 0, planKey);
    const cap = limits.owner_storage_mb;
    if (cap?.quantity != null) {
      const used = await storageUsed({ userId: user.id });
      if (used + body.sizeBytes > cap.quantity * 1024 * 1024) throw Errors.planLimit({ featureKey: "owner_storage_mb", current: Math.round(used / 1024 / 1024), limit: cap.quantity, planKey });
    }
  }
  // Video plan limits: max duration (declared; re-checked on the real file at /media/complete) and videos per day.
  if (body.mimeType.startsWith("video/")) {
    await assertVideoPlanAllowed(partnerId ? { audience: "PARTNER", id: partnerId } : { audience: "OWNER", id: user.id }, body.durationSeconds ?? 0);
  }
  const ip = clientIp(req);
  const target = await createUploadTarget({ ...body, userId: partnerId ? undefined : user.id, partnerId, uploadedByUserId: user.id, uploadIp: isAttributableIp(ip) ? ip : null });
  await rememberIp(user.id, ip);
  return ok(target, { status: 201 });
});
