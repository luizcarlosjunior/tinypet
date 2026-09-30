import { prisma } from "@/db";
import { petFoodSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor, dateOnly, petFoodInclude, resolveFoodProduct } from "@/server/pets";

const include = petFoodInclude;

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  return ok(await prisma.petFood.findMany({ where: { petId: params.id }, include, orderBy: { type: "asc" } }));
});

/** Owner / family only (foods are owner data; partners read them). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via === "partner") throw Errors.forbidden("Apenas o tutor pode alterar a alimentação");
  const body = await resolveFoodProduct(await parseBody(req, petFoodSchema));
  const food = await prisma.petFood.create({ data: { ...body, petId: params.id, lastPurchaseAt: body.lastPurchaseAt ? dateOnly(body.lastPurchaseAt) : null }, include });
  return ok(food, { status: 201 });
});
