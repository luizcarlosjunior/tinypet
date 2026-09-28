import { updatePartnerSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { getPartnerFull, updatePartner, softDeletePartner } from "@/server/partners";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  return ok(serialize(await getPartnerFull(ctx.partnerId)));
});

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  const input = await parseBody(req, updatePartnerSchema);
  return ok(serialize(await updatePartner(ctx.partnerId, input)));
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id, { ownerOnly: true });
  await softDeletePartner(ctx.partnerId);
  return ok({ deleted: true });
});
