import { mediaAuditDecisionSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireAdmin, clientIp } from "@/server";
import { auditDetail, decideAudit } from "@/server/media-audit";

/** GET /admin/media-audit/:assetId → media, uploader (IP, sanctions), where it is used, reports with reporter history. */
export const GET = handler<{ assetId: string }>(async (req, { params }) => {
  await requireAdmin(req);
  return ok(await auditDetail(params.assetId));
});

/**
 * POST /admin/media-audit/:assetId (mediaAuditDecisionSchema)
 * DELETE → real deletion (storage + every reference), reports RESOLVED, optional uploader sanctions (IP 7 days, account 7/15/30/permanent).
 * DISMISS → media kept, reports DISMISSED, optional sanctions for false reporters (account or report ban).
 */
export const POST = handler<{ assetId: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const body = await parseBody(req, mediaAuditDecisionSchema);
  return ok(await decideAudit(params.assetId, body, admin.id, clientIp(req)));
});
