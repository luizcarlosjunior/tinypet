import { prisma } from "@/db";
import { updatePetSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors, serialize, audit, clientIp } from "@/server";
import { petActor, petData, petWithAge, assertOwnerControlled, petRole, ensurePublicSlug } from "@/server/pets";
import { awardBadge } from "@/server/badges";
import { assertOwnMediaUrls } from "@/server/media";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "VIEW");
  const pet = await petWithAge(params.id);
  const [accesses, clients, foods, counts, streak] = await Promise.all([
    // shared accounts only see their own row (never other accounts' e-mails); partners see none
    prisma.petAccess.findMany({ where: { petId: pet.id, ...(actor.via === "owner" ? {} : { userId: actor.user.id }) }, include: { user: { select: { id: true, name: true, username: true, email: true, avatarUrl: true } } } }),
    // a partner viewer only sees its own link (never other partners' client names)
    prisma.clientPet.findMany({ where: { petId: pet.id, client: { deletedAt: null, partner: { deletedAt: null }, ...(actor.via === "partner" ? { partnerId: actor.partnerId } : {}) } }, select: { client: { select: { id: true, name: true, partner: { select: { id: true, slug: true, tradeName: true, logoUrl: true } } } } } }),
    prisma.petFood.findMany({ where: { petId: pet.id }, include: { brand: { select: { id: true, name: true } }, productLine: { select: { id: true, name: true } } } }),
    Promise.all([prisma.petMedia.count({ where: { petId: pet.id, deletedAt: null, isStory: false } }), prisma.earnedBadge.count({ where: { petId: pet.id } }), prisma.petSkill.count({ where: { petId: pet.id, level: "MASTERED" } })]),
    prisma.bodyMeasurement.findFirst({ where: { petId: pet.id }, orderBy: { measuredAt: "desc" }, select: { weightG: true, measuredAt: true } }),
  ]);
  return ok(
    serialize({
      ...pet,
      /** @deprecated use `role`; shared accounts are always read-only (VIEW). */
      access: actor.via === "owner" ? "OWNER" : actor.via === "partner" ? "PARTNER" : "VIEW",
      role: petRole(actor),
      accesses: actor.via === "partner" ? [] : accesses,
      partners: clients.map((c) => ({ client: { id: c.client.id, name: c.client.name }, partner: c.client.partner })),
      foods,
      counts: { media: counts[0], badges: counts[1], masteredSkills: counts[2] },
      lastWeight: streak,
    }),
  );
});

/** Owner only (shared accounts are read-only); a partner only for pets it created that have no owner yet. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  assertOwnerControlled(actor, "Este pet tem tutor: apenas o tutor pode alterar a ficha");
  const body = await parseBody(req, updatePetSchema);
  await assertOwnMediaUrls([body.avatarUrl], actor.user.id, [actor.pet.avatarUrl]);
  const data = await petData(body);
  const pet = await prisma.pet.update({ where: { id: params.id }, data });
  await ensurePublicSlug(pet.id);
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
