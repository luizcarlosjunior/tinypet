import { prisma } from "@tinypet/db";
import { handler, ok, requireAdmin, Errors } from "@/server";

/** POST /admin/brands/:id/approve → brand (and its pending lines) APPROVED. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const brand = await prisma.brand.findUnique({ where: { id: params.id } });
  if (!brand) throw Errors.notFound("Marca não encontrada");
  const [row] = await prisma.$transaction([
    prisma.brand.update({ where: { id: brand.id }, data: { status: "APPROVED" }, include: { lines: true } }),
    prisma.productLine.updateMany({ where: { brandId: brand.id, status: "PENDING" }, data: { status: "APPROVED" } }),
  ]);
  return ok(row);
});
