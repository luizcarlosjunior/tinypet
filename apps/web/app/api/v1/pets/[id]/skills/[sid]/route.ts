import { prisma } from "@tinypet/db";
import { handler, ok, Errors } from "@/server";
import { petActor } from "@/server/pets";

/** `sid` is the skillId (or the PetSkill id). */
export const DELETE = handler<{ id: string; sid: string }>(async (req, { params }) => {
  await petActor(req, params.id, "EDIT");
  const row = await prisma.petSkill.findFirst({ where: { petId: params.id, OR: [{ skillId: params.sid }, { id: params.sid }] } });
  if (!row) throw Errors.notFound("Comando não encontrado");
  await prisma.petSkill.delete({ where: { id: row.id } });
  return ok({ deleted: true });
});
