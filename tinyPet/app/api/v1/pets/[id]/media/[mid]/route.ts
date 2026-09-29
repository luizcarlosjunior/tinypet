import { prisma } from "@/db";
import { petMediaSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor } from "@/server/pets";

async function load(petId: string, mid: string) {
  const m = await prisma.petMedia.findFirst({ where: { id: mid, petId, deletedAt: null } });
  if (!m) throw Errors.notFound("Mídia não encontrada");
  return m;
}

export const PATCH = handler<{ id: string; mid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const m = await load(params.id, params.mid);
  if (actor.via === "partner" && m.uploadedByPartnerId !== actor.partnerId) throw Errors.forbidden("Só é possível editar mídias enviadas pelo seu parceiro");
  const body = await parseBody(req, petMediaSchema.pick({ title: true, description: true, notes: true, visibility: true, takenAt: true }).partial());
  const takenAt = body.takenAt ? new Date(body.takenAt) : undefined;
  return ok(
    await prisma.petMedia.update({
      where: { id: m.id },
      data: { title: body.title, description: body.description, notes: body.notes, visibility: body.visibility, takenAt, ...(takenAt && m.isStory ? { expiresAt: new Date(takenAt.getTime() + 24 * 60 * 60 * 1000) } : {}) },
    }),
  );
});

export const DELETE = handler<{ id: string; mid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const m = await load(params.id, params.mid);
  if (actor.via === "partner" && m.uploadedByPartnerId !== actor.partnerId) throw Errors.forbidden("Só é possível remover mídias enviadas pelo seu parceiro");
  await prisma.petMedia.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
  return ok({ deleted: true });
});
