import { prisma } from "@tinypet/db";
import { handler, ok, Errors, notifyPartner, audit, clientIp } from "@/server";
import { petActor } from "@/server/pets";

/**
 * DELETE /pets/:id/partners/:partnerId (owner only) → revokes the partner's access: removes the ClientPet links between
 * that partner's clients and this pet. The partner's own history rows are kept. The partner is notified.
 */
export const DELETE = handler<{ id: string; partnerId: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "VIEW");
  if (actor.via !== "owner") throw Errors.forbidden("Apenas o tutor principal pode remover o acesso de um parceiro");
  const { count } = await prisma.clientPet.deleteMany({ where: { petId: params.id, client: { partnerId: params.partnerId } } });
  if (!count) throw Errors.notFound("Este parceiro não tem acesso ao pet");
  await audit({ userId: actor.user.id, partnerId: params.partnerId, action: "pet.partner_revoke", entity: "Pet", entityId: params.id, data: { links: count }, ip: clientIp(req) });
  await notifyPartner(params.partnerId, {
    type: "pet_access_revoked",
    title: `O tutor removeu o acesso a ${actor.pet.name}`,
    body: `${actor.user.name} removeu o vínculo do seu negócio com ${actor.pet.name}. O histórico que você registrou foi mantido.`,
    data: { petId: params.id },
  });
  return ok({ revoked: true, links: count });
});
