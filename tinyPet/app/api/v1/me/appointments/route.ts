import { z } from "zod";
import { isoDateTime, dateString } from "@tinypet/shared";
import { handler, ok, parseQuery, requireUser, serialize } from "@/server";
import { listOwnerAppointments, rangeFromQuery, localDateStr } from "@/server/scheduling";
import { addDays } from "@tinypet/shared";

const query = z.object({ from: isoDateTime.or(dateString).optional(), to: isoDateTime.or(dateString).optional() });

/** GET /me/appointments?from&to (defaults: today → +60 days) → owner's appointments across partners, with partner summary and "Como chegar" links. */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const q = parseQuery(req, query);
  const today = localDateStr(new Date());
  const { from, to } = rangeFromQuery(q.from ?? today, q.to ?? localDateStr(addDays(new Date(), 60)));
  return ok(serialize(await listOwnerAppointments(user.id, from, to)));
});
