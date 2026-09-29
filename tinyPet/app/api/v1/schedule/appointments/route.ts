import { agendaQuery, appointmentSchema } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, requirePartner, serialize } from "@/server";
import { createAppointments, listAgenda } from "@/server/scheduling";

/** GET /schedule/appointments (agendaQuery) → appointments with pets, client, item, membership, address, travelLeg, links. */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  const q = parseQuery(req, agendaQuery);
  const items = await listAgenda(ctx.partnerId, q);
  return ok(serialize(items));
});

/**
 * POST /schedule/appointments (appointmentSchema) → CONFIRMED appointment(s). Recurrence generates a series.
 * `?force=true` skips availability/time-off/overlap checks (e.g. group classes).
 */
export const POST = handler(async (req) => {
  const ctx = await requirePartner(req);
  const body = await parseBody(req, appointmentSchema);
  const force = req.nextUrl.searchParams.get("force") === "true";
  const created = await createAppointments({ partnerId: ctx.partnerId, userId: ctx.user.id, membershipId: ctx.membershipId, byPartner: true, force }, body);
  return ok(serialize(created), { status: 201 });
});
