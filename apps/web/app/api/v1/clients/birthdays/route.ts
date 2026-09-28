import { z } from "zod";
import { handler, ok, parseQuery, requirePartner, serialize } from "@/server";
import { birthdays } from "@/server/crm";
import { todaySP } from "@/server/pets";

const query = z.object({ month: z.coerce.number().int().min(1).max(12).optional() });

export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  const { month } = parseQuery(req, query);
  const m = month ?? Number(todaySP().slice(5, 7));
  return ok(serialize({ month: m, ...(await birthdays(ctx.partnerId, m)) }));
});
