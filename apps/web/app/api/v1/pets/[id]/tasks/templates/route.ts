import { prisma } from "@tinypet/db";
import { handler, ok } from "@/server";
import { petActor } from "@/server/pets";

/** Task templates for the pet's species (plus species-agnostic ones). */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  const pet = await prisma.pet.findUniqueOrThrow({ where: { id: params.id }, select: { speciesId: true } });
  return ok(await prisma.taskTemplate.findMany({ where: { OR: [{ speciesId: pet.speciesId }, { speciesId: null }] }, orderBy: { title: "asc" } }));
});
