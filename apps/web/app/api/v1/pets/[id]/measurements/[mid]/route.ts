import { prisma } from "@tinypet/db";
import { bodyMeasurementSchema } from "@tinypet/shared";
import { handler, ok, parseBody, serialize, Errors } from "@/server";
import { petActor, dateOnly, type PetActor } from "@/server/pets";

/** Owners cannot edit/delete rows registered by a partner; a partner only touches its own rows. */
async function load(actor: PetActor, mid: string) {
  const row = await prisma.bodyMeasurement.findFirst({ where: { id: mid, petId: actor.pet.id } });
  if (!row) throw Errors.notFound("Registro não encontrado");
  if (row.partnerId && actor.via !== "partner") throw Errors.forbidden("Registro do parceiro não pode ser alterado pelo tutor");
  if (actor.via === "partner" && row.partnerId !== actor.partnerId) throw Errors.forbidden("Registro de outro parceiro");
  return row;
}

export const PATCH = handler<{ id: string; mid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const row = await load(actor, params.mid);
  const body = await parseBody(req, bodyMeasurementSchema.partial());
  return ok(serialize(await prisma.bodyMeasurement.update({ where: { id: row.id }, data: { ...body, measuredAt: body.measuredAt ? dateOnly(body.measuredAt) : undefined } })));
});

export const DELETE = handler<{ id: string; mid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const row = await load(actor, params.mid);
  await prisma.bodyMeasurement.delete({ where: { id: row.id } });
  return ok({ deleted: true });
});
