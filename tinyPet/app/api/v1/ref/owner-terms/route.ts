import { prisma } from "@/db";
import { handler, ok } from "@/server";
export const GET = handler(async () => ok(await prisma.ownerTerm.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } })));
