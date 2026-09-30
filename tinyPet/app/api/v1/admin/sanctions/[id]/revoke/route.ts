import { handler, ok, requireAdmin, audit, clientIp, revokeSanction } from "@/server";

/** POST /admin/sanctions/:id/revoke → lifts the sanction now (suspension recomputed, IP cache refreshed). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const row = await revokeSanction(params.id, admin.id);
  await audit({ userId: admin.id, action: "sanction.revoke", entity: "UserSanction", entityId: params.id, ip: clientIp(req) });
  return ok(row);
});
