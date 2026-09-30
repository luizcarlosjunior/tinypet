import { z } from "zod";
import { prisma } from "@/db";
import { handler, ok, parseBody, requireUser } from "@/server";

export const GET = handler(async () => {
  const brands = await prisma.brand.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" }, select: { id: true, name: true, status: true, lines: { where: { status: "APPROVED" }, orderBy: { name: "asc" }, select: { id: true, brandId: true, name: true, imageUrl: true, status: true, flavors: { where: { status: "APPROVED" }, orderBy: { name: "asc" }, select: { id: true, name: true, imageUrl: true } } } } } });
  return ok(brands, { cache: 600 });
});

/** Owner suggests a brand/line; admin approves. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const { name, line } = await parseBody(req, z.object({ name: z.string().trim().min(1).max(120), line: z.string().trim().min(1).max(120).optional() }));
  const brand = await prisma.brand.upsert({ where: { name }, update: {}, create: { name, status: "PENDING", suggestedByUserId: user.id } });
  if (line) await prisma.productLine.upsert({ where: { brandId_name: { brandId: brand.id, name: line } }, update: {}, create: { brandId: brand.id, name: line, status: "PENDING" } });
  // never echo who suggested an existing brand
  return ok({ id: brand.id, name: brand.name, status: brand.status }, { status: 201 });
});
