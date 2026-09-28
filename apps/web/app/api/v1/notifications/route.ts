import { prisma } from "@tinypet/db";
import { handler, ok, requireUser } from "@/server";
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return ok(items);
});
export const PATCH = handler(async (req) => {
  const user = await requireUser(req);
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return ok({ read: true });
});
