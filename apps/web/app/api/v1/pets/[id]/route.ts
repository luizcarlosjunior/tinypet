import { prisma } from "@tinypet/db";
import { updatePetSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors, serialize, audit, clientIp } from "@/server";
import { petActor, petData, petWithAge, assertOwnerControlled } from "@/server/pets";
import { awardBadge } from "@/server/badges";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "VIEW");
  const pet = await petWithAge(params.id);
  const [accesses, clients, foods, counts, streak] = await Promise.all([
    prisma.petAccess.findMany({ where: { petId: pet.id }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } }),
    // a partner viewer only sees its own link (never other partners' client names)
    prisma.clientPet.findMany({ where: { petId: pet.id, client: { deletedAt: null, partner: { deletedAt: null }, ...(actor.via === "partner" ? { partnerId: actor.partnerId } : {}) } }, select: { client: { select: { id: true, name: true, partner: { select: { id: true, slug: true, tradeName: true, logoUrl: true } } } } } }),
    prisma.petFood.findMany({ where: { petId: pet.id }, include: { brand: { select: { id: true, name: true } }, productLine: { select: { id: true, name: true } } } }),
    Promise.all([prisma.petMedia.count({ where: { petId: pet.id, deletedAt: null, isStory: false } }), prisma.earnedBadge.count({ where: { petId: pet.id } }), prisma.petSkill.count({ where: { petId: pet.id, level: "MASTERED" } })]),
    prisma.bodyMeasurement.findFirst({ where: { petId: pet.id }, orderBy: { measuredAt: "desc" }, select: { weightG: true, measuredAt: true } }),
  ]);
  return ok(
    serialize({
      ...pet,
      access: actor.via === "owner" ? "OWNER" : actor.via === "partner" ? "PARTNER" : accesses.find((a) => a.userId === actor.user.id)?.level ?? "VIEW",
      accesses: actor.via === "partner" ? [] : accesses,
      partners: clients.map((c) => ({ client: { id: c.client.id, name: c.client.name }, partner: c.client.partner })),
      foods,
      counts: { media: counts[0], badges: counts[1], masteredSkills: counts[2] },
      lastWeight: streak,
    }),
  );
});

/** Owner / family EDIT; a partner only for pets it created that have no owner yet. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  assertOwnerControlled(actor, "Este pet tem tutor: apenas o tutor ou a família podem alterar a ficha");
  const body = await parseBody(req, updatePetSchema);
  const data = await petData(body);
  const pet = await prisma.pet.update({ where: { id: params.id }, data });
  if (pet.avatarUrl) await awardBadge(pet.id, "first_steps");
  return ok(await petWithAge(pet.id));
});

/** Only the primary owner can delete (soft). */
export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via !== "owner") throw Errors.forbidden("Apenas o tutor principal pode excluir o pet");
  await prisma.pet.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await audit({ userId: actor.user.id, action: "pet.delete", entity: "Pet", entityId: params.id, data: { name: actor.pet.name }, ip: clientIp(req) });
  return ok({ deleted: true });
});
