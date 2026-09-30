import { appointmentStatusSchema } from "@tinypet/shared";
import { prisma } from "@/db";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { transitionAppointment } from "@/server/scheduling";
import { assertOwnMediaUrls } from "@/server/media";

/**
 * POST /schedule/appointments/:id/status (appointmentStatusSchema).
 * REQUESTED→CONFIRMED|CANCELED · CONFIRMED→IN_PROGRESS|COMPLETED|CANCELED|NO_SHOW · IN_PROGRESS→COMPLETED|CANCELED.
 * COMPLETED writes a VISIT history event per pet; CANCELED needs cancelReason; CONFIRMED on a reschedule proposal (`rescheduleOfId`) cancels the original (same partner and client only).
 */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const body = await parseBody(req, appointmentStatusSchema);
  if (body.reportPhotos?.length) {
    const cur = await prisma.appointment.findFirst({ where: { id: params.id, partnerId: ctx.partnerId }, select: { reportPhotos: true } });
    await assertOwnMediaUrls(body.reportPhotos, ctx.user.id, Array.isArray(cur?.reportPhotos) ? (cur.reportPhotos as string[]) : []);
  }
  const row = await transitionAppointment({ partnerId: ctx.partnerId, userId: ctx.user.id }, params.id, body);
  return ok(serialize(row));
});
