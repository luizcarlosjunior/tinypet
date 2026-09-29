import { prisma } from "@/db";
import { vaccinationSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor, dateOnly, assertPartnerOwnsRow } from "@/server/pets";

export const PATCH = handler<{ id: string; vid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const row = await prisma.vaccination.findFirst({ where: { id: params.vid, petId: params.id } });
  if (!row) throw Errors.notFound("Registro não encontrado");
  assertPartnerOwnsRow(actor, row.partnerId);
  const body = await parseBody(req, vaccinationSchema.partial());
  return ok(
    await prisma.vaccination.update({
      where: { id: row.id },
      data: { ...body, appliedAt: body.appliedAt ? dateOnly(body.appliedAt) : undefined, nextDueAt: body.nextDueAt === undefined ? undefined : body.nextDueAt ? dateOnly(body.nextDueAt) : null },
      include: { partner: { select: { id: true, tradeName: true } } },
    }),
  );
});

export const DELETE = handler<{ id: string; vid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const row = await prisma.vaccination.findFirst({ where: { id: params.vid, petId: params.id } });
  if (!row) throw Errors.notFound("Registro não encontrado");
  assertPartnerOwnsRow(actor, row.partnerId);
  await prisma.vaccination.delete({ where: { id: row.id } });
  return ok({ deleted: true });
});
