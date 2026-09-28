import { z } from "zod";
import { prisma } from "@tinypet/db";
import { bodyMeasurementSchema } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, serialize, Errors } from "@/server";
import { petActor, measurementsFor, dateOnly, partnerHasType } from "@/server/pets";

const query = z.object({ period: z.enum(["6m", "1y", "all"]).default("all") });

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  const { period } = parseQuery(req, query);
  const { items, lifeStage, reference, alerts } = await measurementsFor(params.id, period);
  return ok(serialize({ period, items, lifeStage, reference, alerts }));
});

/** Partner rows get `vetVerified` when the partner is a vet clinic. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.pet.status === "DECEASED") throw Errors.conflict("Pet em memorial");
  const body = await parseBody(req, bodyMeasurementSchema);
  const vetVerified = actor.via === "partner" && actor.partnerId ? await partnerHasType(actor.partnerId, "vet_clinic") : false;
  const row = await prisma.bodyMeasurement.create({
    data: {
      ...body,
      petId: params.id,
      measuredAt: dateOnly(body.measuredAt),
      userId: actor.via === "partner" ? null : actor.user.id,
      partnerId: actor.via === "partner" ? actor.partnerId : null,
      vetVerified,
    },
    include: { user: { select: { id: true, name: true } }, partner: { select: { id: true, tradeName: true } } },
  });
  const { alerts } = await measurementsFor(params.id, "all");
  return ok(serialize({ ...row, alerts }), { status: 201 });
});
