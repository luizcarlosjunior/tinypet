import { z } from "zod";
import { prisma } from "@/db";
import { handler, ok, parseQuery, requireAdmin, serialize } from "@/server";
import { reportInclude } from "@/server/admin";

const query = z.object({ status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).optional() });

/** GET /admin/reports?status (default OPEN) */
export const GET = handler(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, query);
  const rows = await prisma.report.findMany({ where: { status: q.status ?? "OPEN" }, include: reportInclude, orderBy: { createdAt: "desc" } });
  // Report has no MediaAsset relation: attach the asset (thumbnail) for media reports
  const mediaIds = [...new Set(rows.map((r) => r.mediaAssetId).filter((v): v is string => !!v))];
  const assets = mediaIds.length ? await prisma.mediaAsset.findMany({ where: { id: { in: mediaIds } }, select: { id: true, url: true, thumbUrl: true, kind: true, status: true } }) : [];
  const byId = new Map(assets.map((a) => [a.id, a]));
  return ok(serialize(rows.map((r) => ({ ...r, mediaAsset: r.mediaAssetId ? byId.get(r.mediaAssetId) ?? null : null }))));
});
