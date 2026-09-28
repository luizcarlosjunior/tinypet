import { prisma } from "@tinypet/db";
import { handler, ok, requirePartner, Errors } from "@/server";
import { getClient } from "@/server/crm";

/** Links an existing pet. Only pets owned by the tutor account linked to this client (via invite) can be linked. */
export const PUT = handler<{ id: string; petId: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  if (!client.userId) throw Errors.forbidden("Vincule o cliente a uma conta (convite) antes de vincular pets existentes");
  const pet = await prisma.pet.findFirst({ where: { id: params.petId, deletedAt: null, ownerId: client.userId } });
  if (!pet) throw Errors.notFound("Pet não encontrado na conta do tutor");
  // the tutor revoked this partner (DELETE /pets/:id/partners/:partnerId): only the tutor can re-link (e.g. by booking again)
  const revoked = await prisma.auditLog.findFirst({ where: { action: "pet.partner_revoke", entity: "Pet", entityId: pet.id, partnerId: ctx.partnerId }, select: { id: true } });
  if (revoked) throw Errors.forbidden("O tutor removeu o acesso do seu negócio a este pet");
  await prisma.clientPet.upsert({ where: { clientId_petId: { clientId: client.id, petId: pet.id } }, update: {}, create: { clientId: client.id, petId: pet.id } });
  return ok({ linked: true, petId: pet.id });
});

/** Unlinks the pet from the client. Partner-created pets without a tutor are soft-deleted. */
export const DELETE = handler<{ id: string; petId: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  const link = await prisma.clientPet.findUnique({ where: { clientId_petId: { clientId: client.id, petId: params.petId } }, include: { pet: { select: { ownerId: true, createdByPartnerId: true } } } });
  if (!link) throw Errors.notFound("Pet não vinculado a este cliente");
  await prisma.clientPet.delete({ where: { clientId_petId: { clientId: client.id, petId: params.petId } } });
  if (!link.pet.ownerId && link.pet.createdByPartnerId === ctx.partnerId) {
    await prisma.pet.update({ where: { id: params.petId }, data: { deletedAt: new Date() } });
  }
  return ok({ unlinked: true });
});
