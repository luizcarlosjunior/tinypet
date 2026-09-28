import { prisma } from "@tinypet/db";
import { updateAppointmentSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize, Errors } from "@/server";
import { appointmentInclude, decorateAppointment, deleteAppointment, updateAppointment } from "@/server/scheduling";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const row = await prisma.appointment.findFirst({ where: { id: params.id, partnerId: ctx.partnerId }, include: { ...appointmentInclude, contract: { select: { id: true, title: true, status: true } }, historyEvents: true } });
  if (!row) throw Errors.notFound("Agendamento não encontrado");
  // contract status is finance data
  const contract = row.contract ? (ctx.canSeeFinance ? row.contract : { id: row.contract.id, title: row.contract.title }) : null;
  return ok(serialize({ ...decorateAppointment(row), contract }));
});

/** PATCH /schedule/appointments/:id (updateAppointmentSchema); `?force=true` skips conflict checks. Legs are recomputed. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const body = await parseBody(req, updateAppointmentSchema);
  const force = req.nextUrl.searchParams.get("force") === "true";
  const row = await updateAppointment({ partnerId: ctx.partnerId, userId: ctx.user.id, membershipId: ctx.membershipId, byPartner: true, force }, params.id, body);
  return ok(serialize(row));
});

/** DELETE /schedule/appointments/:id → hard delete (not allowed for COMPLETED); owner is notified when it was active. */
export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  await deleteAppointment(ctx, params.id);
  return ok({ deleted: true });
});
