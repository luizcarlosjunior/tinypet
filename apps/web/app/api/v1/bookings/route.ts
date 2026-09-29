import { prisma } from "@tinypet/db";
import { bookingRequestSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize, assertFeature, notifyPartner, Errors } from "@/server";
import { createAppointments, editablePetOr, formatLocal, resolveOwnerClient } from "@/server/scheduling";

/** POST /bookings (bookingRequestSchema) → REQUESTED appointment for a bookable, published item; partner is notified. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, bookingRequestSchema);
  const partner = await prisma.partner.findFirst({ where: { id: body.partnerId, deletedAt: null, published: true }, select: { id: true, tradeName: true } });
  if (!partner) throw Errors.notFound("Parceiro não encontrado");
  const item = await prisma.catalogItem.findFirst({ where: { id: body.itemId, partnerId: partner.id, deletedAt: null, status: "PUBLISHED", bookable: true } });
  if (!item) throw Errors.badRequest("Este serviço não aceita agendamento online");
  await assertFeature("PARTNER", partner.id, "online_booking");

  const petIds = [...new Set(body.petIds)];
  const pets = await prisma.pet.count({ where: { id: { in: petIds }, deletedAt: null, status: "ACTIVE", OR: editablePetOr(user.id) } });
  if (pets !== petIds.length) throw Errors.forbidden("Escolha apenas pets seus (pets compartilhados com você só o tutor dono pode agendar)");

  const allowed = (item.serviceLocations as string[] | null) ?? [];
  const locationType = body.locationType ?? item.defaultLocation ?? "PARTNER_VENUE";
  if (allowed.length && !allowed.includes(locationType)) throw Errors.badRequest("Local de atendimento não disponível para este serviço");

  const client = await resolveOwnerClient(partner.id, user, petIds);
  const [created] = await createAppointments(
    { partnerId: partner.id, userId: user.id, byPartner: false },
    {
      clientId: client.id,
      petIds,
      itemId: item.id,
      title: item.name,
      startsAt: body.startsAt,
      durationMinutes: item.durationMinutes ?? 60,
      locationType,
      addressId: body.addressId ?? null,
      notes: body.notes ?? null,
      recurrence: "NONE",
      status: "REQUESTED",
      requestedByUserId: user.id,
      rescheduleOfId: null, // server-only field; never taken from the request
    },
  );
  await notifyPartner(partner.id, { type: "appointment.requested", title: "Novo pedido de agendamento", body: `${user.name} pediu "${item.name}" em ${formatLocal(created!.startsAt)}. Confirme na agenda.`, data: { appointmentId: created!.id }, email: true });
  return ok(serialize(created), { status: 201 });
});
