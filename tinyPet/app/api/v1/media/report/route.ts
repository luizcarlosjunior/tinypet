import { mediaReportSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, clientIp } from "@/server";
import { reportMedia } from "@/server/media-audit";

/**
 * POST /media/report { url, reason, details? } — reports a photo/video that breaks the community rules
 * (20/h per user; not your own media; once per media). 403 REPORT_BANNED for users barred after false reports.
 */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, mediaReportSchema);
  return ok(await reportMedia(user.id, body, clientIp(req)), { status: 201 });
});
