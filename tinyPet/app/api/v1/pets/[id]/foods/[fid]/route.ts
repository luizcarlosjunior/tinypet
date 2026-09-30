import { prisma } from "@/db";
import { petFoodSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor, dateOnly, petFoodInclude, resolveFoodProduct } from "@/server/pets";

const include = petFoodInclude;

export const PATCH = handler<{ id: string; fid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via === "partner") throw Errors.forbidden("Apenas o tutor pode alterar a alimentação");
  const row = await prisma.petFood.findFirst({ where: { id: params.fid, petId: params.id } });
  if (!row) throw Errors.notFound("Alimento não encontrado");
  const body = await resolveFoodProduct(await parseBody(req, petFoodSchema.partial()));
  return ok(await prisma.petFood.update({ where: { id: row.id }, data: { ...body, lastPurchaseAt: body.lastPurchaseAt === undefined ? undefined : body.lastPurchaseAt ? dateOnly(body.lastPurchaseAt) : null }, include }));
});

export const DELETE = handler<{ id: string; fid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via === "partner") throw Errors.forbidden("Apenas o tutor pode alterar a alimentação");
  const row = await prisma.petFood.findFirst({ where: { id: params.fid, petId: params.id } });
  if (!row) throw Errors.notFound("Alimento não encontrado");
  await prisma.petFood.delete({ where: { id: row.id } });
  return ok({ deleted: true });
});
