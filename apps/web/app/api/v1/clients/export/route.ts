import { handler, requirePartner } from "@/server";
import { exportClientsCsv } from "@/server/crm";
import { csvResponse } from "@/server/csv";
import { todaySP } from "@/server/pets";

export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  return csvResponse(await exportClientsCsv(ctx.partnerId), `clientes-${todaySP()}.csv`);
});
