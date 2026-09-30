import { prisma } from "@/db";
import { vaccinationSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor, dateOnly, assertPartnerOwnsRow, partnerHasType, vaccinationInclude } from "@/server/pets";

/** `weightG`: number → creates/updates the linked measurement; null → removes it; omitted → unchanged (date follows appliedAt). */
export const PATCH = handler<{ id: string; vid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const row = await prisma.vaccination.findFirst({ where: { id: params.vid, petId: params.id } });
  if (!row) throw Errors.notFound("Registro não encontrado");
  assertPartnerOwnsRow(actor, row.partnerId);
  const { weightG, ...body } = await parseBody(req, vaccinationSchema.partial());
  if (weightG && actor.pet.status === "DECEASED") throw Errors.conflict("Pet em memorial: não é possível registrar peso");
  const appliedAt = body.appliedAt ? dateOnly(body.appliedAt) : row.appliedAt;
  const partnerId = actor.via === "partner" ? actor.partnerId ?? null : null;
  const updated = await prisma.$transaction(async (tx) => {
    let measurementId = row.measurementId;
    if (weightG === null && measurementId) {
      await tx.bodyMeasurement.delete({ where: { id: measurementId } }).catch(() => undefined);
      measurementId = null;
    } else if (weightG) {
      if (measurementId) {
        await tx.bodyMeasurement.update({ where: { id: measurementId }, data: { weightG, measuredAt: appliedAt } });
      } else {
        const vetVerified = partnerId ? await partnerHasType(partnerId, "vet_clinic") : false;
        const m = await tx.bodyMeasurement.create({ data: { petId: params.id, measuredAt: appliedAt, weightG, userId: partnerId ? null : actor.user.id, partnerId, vetVerified, notes: `Pesagem na dose: ${body.name ?? row.name}` } });
        measurementId = m.id;
      }
    } else if (measurementId && body.appliedAt) {
      await tx.bodyMeasurement.update({ where: { id: measurementId }, data: { measuredAt: appliedAt } });
    }
    return tx.vaccination.update({
      where: { id: row.id },
      data: { ...body, appliedAt: body.appliedAt ? appliedAt : undefined, nextDueAt: body.nextDueAt === undefined ? undefined : body.nextDueAt ? dateOnly(body.nextDueAt) : null, measurementId },
      include: vaccinationInclude,
    });
  });
  return ok(updated);
});

/** The weight taken at the dose stays as a regular measurement (it is still a real weighing). */
export const DELETE = handler<{ id: string; vid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const row = await prisma.vaccination.findFirst({ where: { id: params.vid, petId: params.id } });
  if (!row) throw Errors.notFound("Registro não encontrado");
  assertPartnerOwnsRow(actor, row.partnerId);
  await prisma.vaccination.delete({ where: { id: row.id } });
  return ok({ deleted: true });
});
