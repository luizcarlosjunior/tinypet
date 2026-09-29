import { prisma } from "@/db";
import { petFoodSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor, dateOnly } from "@/server/pets";

const include = { brand: { select: { id: true, name: true, status: true } }, productLine: { select: { id: true, name: true } } };

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  return ok(await prisma.petFood.findMany({ where: { petId: params.id }, include, orderBy: { type: "asc" } }));
});

/** Owner / family only (foods are owner data; partners read them). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via === "partner") throw Errors.forbidden("Apenas o tutor pode alterar a alimentação");
  const body = await parseBody(req, petFoodSchema);
  if (body.productLineId) {
    const line = await prisma.productLine.findUnique({ where: { id: body.productLineId } });
    if (!line || (body.brandId && line.brandId !== body.brandId)) throw Errors.badRequest("Linha não pertence à marca");
    body.brandId = body.brandId ?? line.brandId;
  }
  const food = await prisma.petFood.create({ data: { ...body, petId: params.id, lastPurchaseAt: body.lastPurchaseAt ? dateOnly(body.lastPurchaseAt) : null }, include });
  return ok(food, { status: 201 });
});
