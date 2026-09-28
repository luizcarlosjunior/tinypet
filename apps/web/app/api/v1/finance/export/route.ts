import { z } from "zod";
import { dateString } from "@tinypet/shared";
import { handler, parseQuery, requirePartner, audit, clientIp } from "@/server";
import { exportCsv } from "@/server/finance";

const query = z.object({ type: z.enum(["installments", "transactions"]).default("installments"), from: dateString.optional(), to: dateString.optional() });

/** GET /finance/export?type=installments|transactions&from&to → CSV (BOM, `;`, pt-BR decimals). */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const q = parseQuery(req, query);
  const csv = await exportCsv(ctx.partnerId, q.type, q);
  await audit({ userId: ctx.user.id, partnerId: ctx.partnerId, action: "finance.export", entity: "Partner", entityId: ctx.partnerId, data: { type: q.type, from: q.from ?? null, to: q.to ?? null }, ip: clientIp(req) });
  return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${q.type}.csv"` } });
});
