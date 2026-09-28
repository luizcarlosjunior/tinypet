import { prisma } from "@tinypet/db";
import { updatePartnerSchema, onlyDigits } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize, audit, clientIp, Errors } from "@/server";
import { getPartnerFull, updatePartner, softDeletePartner } from "@/server/partners";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  return ok(serialize(await getPartnerFull(ctx.partnerId)));
});

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  const input = await parseBody(req, updatePartnerSchema);
  // legal identity (document, legal/trade name → slug) is owner-only; other profile fields stay member-writable
  if (ctx.role !== "OWNER") {
    const cur = await prisma.partner.findUniqueOrThrow({ where: { id: ctx.partnerId }, select: { documentType: true, document: true, legalName: true, tradeName: true } });
    const changed =
      (input.documentType !== undefined && input.documentType !== cur.documentType) ||
      (input.document !== undefined && onlyDigits(input.document ?? "") !== onlyDigits(cur.document ?? "")) ||
      (input.legalName !== undefined && (input.legalName || null) !== (cur.legalName || null)) ||
      (input.tradeName !== undefined && input.tradeName !== cur.tradeName);
    if (changed) throw Errors.forbidden("Apenas o dono pode alterar documento, razão social ou nome fantasia");
  }
  return ok(serialize(await updatePartner(ctx.partnerId, input)));
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id, { ownerOnly: true });
  await softDeletePartner(ctx.partnerId);
  await audit({ userId: ctx.user.id, partnerId: ctx.partnerId, action: "partner.delete", entity: "Partner", entityId: ctx.partnerId, ip: clientIp(req) });
  return ok({ deleted: true });
});
