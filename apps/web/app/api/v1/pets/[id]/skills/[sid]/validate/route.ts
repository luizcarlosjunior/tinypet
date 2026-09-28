import { prisma } from "@tinypet/db";
import { handler, ok, Errors, notify } from "@/server";
import { petActor, partnerHasType } from "@/server/pets";

/** Partner context (X-Partner-Id) with type `trainer`: stamps "validado por adestrador". */
export const POST = handler<{ id: string; sid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via !== "partner" || !actor.partnerId) throw Errors.forbidden("Apenas parceiros vinculados podem validar comandos");
  if (!(await partnerHasType(actor.partnerId, "trainer"))) throw Errors.forbidden("Apenas adestradores podem validar comandos");
  const row = await prisma.petSkill.findFirst({ where: { petId: params.id, OR: [{ skillId: params.sid }, { id: params.sid }] }, include: { skill: true } });
  if (!row) throw Errors.notFound("Comando não encontrado");
  if (row.level !== "MASTERED") throw Errors.badRequest("Só comandos dominados podem ser validados");
  const updated = await prisma.petSkill.update({ where: { id: row.id }, data: { validatedByPartnerId: actor.partnerId, validatedAt: new Date() }, include: { skill: true } });
  if (actor.pet.ownerId) {
    const partner = await prisma.partner.findUnique({ where: { id: actor.partnerId }, select: { tradeName: true } });
    await notify({ userId: actor.pet.ownerId, type: "skill_validated", title: `${partner?.tradeName ?? "Adestrador"} validou "${row.skill.name}"`, body: `O comando de ${actor.pet.name} ganhou o selo de validado por adestrador.`, data: { petId: params.id, skillId: row.skillId } });
  }
  return ok(updated);
});
