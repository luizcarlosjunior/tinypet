import { appointmentStatusSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { transitionAppointment } from "@/server/scheduling";

/**
 * POST /schedule/appointments/:id/status (appointmentStatusSchema).
 * REQUESTED→CONFIRMED|CANCELED · CONFIRMED→IN_PROGRESS|COMPLETED|CANCELED|NO_SHOW · IN_PROGRESS→COMPLETED|CANCELED.
 * COMPLETED writes a VISIT history event per pet; CANCELED needs cancelReason; CONFIRMED on a "reschedule:<id>" proposal cancels the original.
 */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const body = await parseBody(req, appointmentStatusSchema);
  const row = await transitionAppointment({ partnerId: ctx.partnerId, userId: ctx.user.id }, params.id, body);
  return ok(serialize(row));
});
