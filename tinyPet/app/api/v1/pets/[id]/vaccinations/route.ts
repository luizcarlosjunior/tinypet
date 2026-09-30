import { prisma } from "@/db";
import { vaccinationSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor, dateOnly, partnerHasType, vaccinationInclude } from "@/server/pets";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  return ok(await prisma.vaccination.findMany({ where: { petId: params.id }, include: vaccinationInclude, orderBy: { appliedAt: "desc" } }));
});

/**
 * Also writes a VACCINE/DEWORMING history event. `nextDueAt` feeds the reminder job. Optional `weightG` is recorded as a
 * body measurement on `appliedAt` (weight chart and alerts), linked to the dose.
 */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const { weightG, ...body } = await parseBody(req, vaccinationSchema);
  if (weightG && actor.pet.status === "DECEASED") throw Errors.conflict("Pet em memorial: não é possível registrar peso");
  const partnerId = actor.via === "partner" ? actor.partnerId ?? null : null;
  const appliedAt = dateOnly(body.appliedAt);
  const vetVerified = weightG && partnerId ? await partnerHasType(partnerId, "vet_clinic") : false;
  const row = await prisma.$transaction(async (tx) => {
    const measurement = weightG ? await tx.bodyMeasurement.create({ data: { petId: params.id, measuredAt: appliedAt, weightG, userId: partnerId ? null : actor.user.id, partnerId, vetVerified, notes: `Pesagem na dose: ${body.name}` } }) : null;
    await tx.petHistoryEvent.create({ data: { petId: params.id, type: body.kind, title: body.name, description: body.notes ?? null, occurredAt: appliedAt, partnerId, userId: partnerId ? null : actor.user.id } });
    return tx.vaccination.create({
      data: { petId: params.id, kind: body.kind, name: body.name, appliedAt, nextDueAt: body.nextDueAt ? dateOnly(body.nextDueAt) : null, notes: body.notes ?? null, partnerId, measurementId: measurement?.id ?? null },
      include: vaccinationInclude,
    });
  });
  return ok(row, { status: 201 });
});
