import { handler, requirePartner, audit, clientIp } from "@/server";
import { exportClientsCsv } from "@/server/crm";
import { csvResponse } from "@/server/csv";
import { todaySP } from "@/server/pets";

export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  const csv = await exportClientsCsv(ctx.partnerId);
  await audit({ userId: ctx.user.id, partnerId: ctx.partnerId, action: "clients.export", entity: "Partner", entityId: ctx.partnerId, ip: clientIp(req) });
  return csvResponse(csv, `clientes-${todaySP()}.csv`);
});
