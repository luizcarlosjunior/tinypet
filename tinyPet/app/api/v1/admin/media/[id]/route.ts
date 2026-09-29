import { prisma } from "@/db";
import { handler, ok, parseBody, requireAdmin, audit, clientIp, Errors } from "@/server";
import { mediaModerationSchema } from "@/server/admin";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const m = await prisma.mediaAsset.findUnique({ where: { id: params.id }, include: { user: { select: { id: true, name: true } }, partner: { select: { id: true, tradeName: true } } } });
  if (!m) throw Errors.notFound("Mídia não encontrada");
  return ok(m);
});

/** POST /admin/media/:id {action:"APPROVE"|"REJECT"} → READY | REJECTED; open reports on the asset are resolved. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { action } = await parseBody(req, mediaModerationSchema);
  const m = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!m) throw Errors.notFound("Mídia não encontrada");
  const [row] = await prisma.$transaction([
    prisma.mediaAsset.update({ where: { id: m.id }, data: { status: action === "APPROVE" ? "READY" : "REJECTED" } }),
    prisma.report.updateMany({ where: { mediaAssetId: m.id, status: "OPEN" }, data: { status: action === "APPROVE" ? "DISMISSED" : "RESOLVED" } }),
  ]);
  await audit({ userId: admin.id, action: `media.${action.toLowerCase()}`, entity: "MediaAsset", entityId: m.id, ip: clientIp(req) });
  return ok(row);
});
