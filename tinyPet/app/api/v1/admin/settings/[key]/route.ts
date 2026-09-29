import { prisma, type Prisma } from "@/db";
import { handler, ok, parseBody, requireAdmin, Errors } from "@/server";
import { settingSchema } from "@/server/admin";

export const GET = handler<{ key: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const row = await prisma.setting.findUnique({ where: { key: params.key } });
  if (!row) throw Errors.notFound("Configuração não encontrada");
  return ok(row);
});

/** PUT /admin/settings/:key {value} → upsert (value is any JSON). */
export const PUT = handler<{ key: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const body = await parseBody(req, settingSchema);
  if (body.value === undefined) throw Errors.badRequest("Informe value");
  const value = body.value as Prisma.InputJsonValue;
  const row = await prisma.setting.upsert({ where: { key: params.key }, update: { value }, create: { key: params.key, value } });
  return ok(row);
});

export const DELETE = handler<{ key: string }>(async (req, { params }) => {
  await requireAdmin(req);
  await prisma.setting.delete({ where: { key: params.key } });
  return ok({ deleted: true });
});
