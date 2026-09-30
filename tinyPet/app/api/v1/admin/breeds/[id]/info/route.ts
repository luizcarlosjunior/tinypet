import { handler, ok, requireAdmin, audit, clientIp } from "@/server";
import { breedInfo } from "@/server/breed-info";

/** POST /admin/breeds/:id/info → forces a new API Ninjas lookup (e.g. after fixing the English name). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const info = await breedInfo(params.id, { refresh: true });
  await audit({ userId: admin.id, action: "breed.info_refresh", entity: "Breed", entityId: params.id, data: { found: !!info }, ip: clientIp(req) });
  return ok(info);
});
