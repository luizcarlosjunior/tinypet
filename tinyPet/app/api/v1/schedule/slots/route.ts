import { slotsQuery } from "@tinypet/shared";
import { handler, ok, parseQuery, requirePartner } from "@/server";
import { computeSlots } from "@/server/scheduling";

/** GET /schedule/slots?itemId&date&membershipId? → free Slot[] (availability − time-offs − appointments − travel − buffer). */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  const q = parseQuery(req, slotsQuery);
  return ok(await computeSlots({ partnerId: ctx.partnerId, ...q }));
});
