import { inviteMemberSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { listMembers, inviteMember } from "@/server/partners";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  return ok(serialize(await listMembers(ctx.partnerId)));
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id, { ownerOnly: true });
  const body = await parseBody(req, inviteMemberSchema);
  return ok(serialize(await inviteMember(ctx.partnerId, body)), { status: 201 });
});
