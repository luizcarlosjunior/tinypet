import { z } from "zod";
import { prisma } from "@tinypet/db";
import { handler, ok, parseBody, requireUser } from "@/server";

export const GET = handler(async () => {
  const brands = await prisma.brand.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" }, include: { lines: { where: { status: "APPROVED" }, orderBy: { name: "asc" } } } });
  return ok(brands);
});

/** Owner suggests a brand/line; admin approves. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const { name, line } = await parseBody(req, z.object({ name: z.string().min(1), line: z.string().optional() }));
  const brand = await prisma.brand.upsert({ where: { name }, update: {}, create: { name, status: "PENDING", suggestedByUserId: user.id } });
  if (line) await prisma.productLine.upsert({ where: { brandId_name: { brandId: brand.id, name: line } }, update: {}, create: { brandId: brand.id, name: line, status: "PENDING" } });
  return ok(brand, { status: 201 });
});
