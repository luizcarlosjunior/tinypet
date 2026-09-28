import { z } from "zod";
import { MembershipRoleEnum } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { updateMember, removeMember } from "@/server/partners";

const updateMemberSchema = z.object({
  role: MembershipRoleEnum.optional(),
  canSeeFinance: z.boolean().optional(),
  jobTitle: z.string().max(80).optional().nullable(),
  baseAddressId: z.string().min(1).optional().nullable(),
  costPerKm: z.coerce.number().min(0).optional().nullable(),
  navApp: z.enum(["google", "waze", "apple"]).optional().nullable(),
});

export const PATCH = handler<{ id: string; mid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id, { ownerOnly: true });
  const body = await parseBody(req, updateMemberSchema);
  return ok(serialize(await updateMember(ctx.partnerId, params.mid, body)));
});

export const DELETE = handler<{ id: string; mid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id, { ownerOnly: true });
  await removeMember(ctx.partnerId, params.mid);
  return ok({ deleted: true });
});
