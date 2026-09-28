import { prisma } from "@tinypet/db";
import { handler, ok, Errors } from "@/server";
import { petActor } from "@/server/pets";

/** Owner removes someone's access; a family member can remove their own. */
export const DELETE = handler<{ id: string; uid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "VIEW");
  if (actor.via !== "owner" && actor.user.id !== params.uid) throw Errors.forbidden();
  await prisma.petAccess.deleteMany({ where: { petId: params.id, userId: params.uid } });
  return ok({ deleted: true });
});
