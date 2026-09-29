import { prisma } from "@/db";
import { handler, ok, Errors } from "@/server";
import { petActor, assertPartnerOwnsRow } from "@/server/pets";

/** `sid` is the skillId (or the PetSkill id). */
export const DELETE = handler<{ id: string; sid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const row = await prisma.petSkill.findFirst({ where: { petId: params.id, OR: [{ skillId: params.sid }, { id: params.sid }] } });
  if (!row) throw Errors.notFound("Comando não encontrado");
  assertPartnerOwnsRow(actor, row.markedByPartnerId, "Comando registrado pelo tutor ou por outro parceiro");
  await prisma.petSkill.delete({ where: { id: row.id } });
  return ok({ deleted: true });
});
