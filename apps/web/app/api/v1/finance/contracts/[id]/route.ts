import { z } from "zod";
import { id } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize, clientIp } from "@/server";
import { getContract, updateContract } from "@/server/finance";

const patchSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  sessionsCount: z.coerce.number().int().min(1).max(200).nullable().optional(),
  petIds: z.array(id).optional(),
});

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  return ok(serialize(await getContract(ctx.partnerId, params.id)));
});

/** PATCH /finance/contracts/:id {title?, description?, terms?, sessionsCount?, petIds?} (amounts/installments are immutable). */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const body = await parseBody(req, patchSchema);
  return ok(serialize(await updateContract({ partnerId: ctx.partnerId, userId: ctx.user.id, membershipId: ctx.membershipId, ip: clientIp(req) }, params.id, body)));
});
