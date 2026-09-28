import { z } from "zod";
import { prisma } from "@tinypet/db";
import { handler, ok, parseBody, requireUser } from "@/server";
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const { token, platform } = await parseBody(req, z.object({ token: z.string().min(1), platform: z.string().default("unknown") }));
  await prisma.pushToken.upsert({ where: { token }, update: { userId: user.id, platform }, create: { userId: user.id, token, platform } });
  return ok({ saved: true });
});
export const DELETE = handler(async (req) => {
  const user = await requireUser(req);
  const { token } = await parseBody(req, z.object({ token: z.string().min(1) }));
  await prisma.pushToken.deleteMany({ where: { token, userId: user.id } });
  return ok({ removed: true });
});
