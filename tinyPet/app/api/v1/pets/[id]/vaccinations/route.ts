import { prisma } from "@/db";
import { vaccinationSchema } from "@tinypet/shared";
import { handler, ok, parseBody } from "@/server";
import { petActor, dateOnly } from "@/server/pets";

const include = { partner: { select: { id: true, tradeName: true } } };

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  return ok(await prisma.vaccination.findMany({ where: { petId: params.id }, include, orderBy: { appliedAt: "desc" } }));
});

/** Also writes a VACCINE/DEWORMING history event. `nextDueAt` feeds the reminder job. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const body = await parseBody(req, vaccinationSchema);
  const partnerId = actor.via === "partner" ? actor.partnerId ?? null : null;
  const [row] = await prisma.$transaction([
    prisma.vaccination.create({
      data: { petId: params.id, kind: body.kind, name: body.name, appliedAt: dateOnly(body.appliedAt), nextDueAt: body.nextDueAt ? dateOnly(body.nextDueAt) : null, notes: body.notes ?? null, partnerId },
      include,
    }),
    prisma.petHistoryEvent.create({
      data: { petId: params.id, type: body.kind, title: body.name, description: body.notes ?? null, occurredAt: dateOnly(body.appliedAt), partnerId, userId: partnerId ? null : actor.user.id },
    }),
  ]);
  return ok(row, { status: 201 });
});
