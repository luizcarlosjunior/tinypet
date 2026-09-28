import { prisma } from "@tinypet/db";
import { handler, ok } from "@/server";

export const GET = handler(async () => {
  const species = await prisma.species.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, include: { breeds: { orderBy: [{ isMixed: "desc" }, { name: "asc" }], select: { id: true, name: true, isMixed: true, isOther: true } } } });
  return ok(species);
});
