import { handler, ok } from "@/server";
import { inviteByToken } from "@/server/crm";

/** Public: what the tutor sees before accepting. */
export const GET = handler<{ token: string }>(async (_req, { params }) => {
  const invite = await inviteByToken(params.token);
  return ok({
    status: invite.status,
    expiresAt: invite.expiresAt,
    partner: invite.partner,
    clientName: invite.client.name,
    // no internal ids of other accounts (ownerId) in this public preview
    pets: invite.client.pets.map(({ pet: { ownerId: _o, ...p } }) => p),
  });
});
