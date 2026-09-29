import { handler, ok, requireUser, requirePartner, getVideoLimits } from "@/server";

/**
 * Video limits for the caller, so clients can check before transcoding.
 * With X-Partner-Id → partner plan (videos_per_day / video_max_seconds); otherwise the owner plan.
 */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const owner = req.headers.get("x-partner-id") ? { audience: "PARTNER" as const, id: (await requirePartner(req)).partnerId } : { audience: "OWNER" as const, id: user.id };
  return ok(await getVideoLimits(owner));
});
