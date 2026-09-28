import { prisma } from "@tinypet/db";
import { handler, ok } from "@/server";

export const GET = handler(async () => {
  const categories = await prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, include: { subcategories: { where: { active: true }, orderBy: { sortOrder: "asc" } } } });
  return ok(categories);
});
