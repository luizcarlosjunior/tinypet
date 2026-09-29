import { z } from "zod";
import { dateString, id } from "@tinypet/shared";
import { handler, ok, parseQuery, requirePartner, serialize } from "@/server";
import { dayRoute } from "@/server/scheduling";

const query = z.object({ date: dateString, membershipId: id.optional() });

/** GET /schedule/day-route?date=&membershipId= → ordered CLIENT_HOME stops, legs, totals, Google Maps URL, alerts and suggestions. */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  const q = parseQuery(req, query);
  return ok(serialize(await dayRoute(ctx.partnerId, q.membershipId ?? ctx.membershipId, q.date)));
});
