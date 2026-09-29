import { z } from "zod";
import { prisma } from "@/db";
import { handler, ok, parseBody, requireUser } from "@/server";

const tokenSchema = z.string().trim().min(1).max(191);

/**
 * POST { token, platform } (authenticated). Push tokens are device-bound: when a device switches account, the token
 * moves to the caller (previous owner's row is replaced) so a device never receives another user's notifications.
 * The response never reveals whether the token belonged to someone else.
 */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const { token, platform } = await parseBody(req, z.object({ token: tokenSchema, platform: z.string().trim().max(20).default("unknown") }));
  await prisma.$transaction([
    prisma.pushToken.deleteMany({ where: { token, userId: { not: user.id } } }),
    prisma.pushToken.upsert({ where: { token }, update: { platform }, create: { userId: user.id, token, platform } }),
  ]);
  return ok({ saved: true });
});

/** DELETE { token } — only removes the caller's own token. */
export const DELETE = handler(async (req) => {
  const user = await requireUser(req);
  const { token } = await parseBody(req, z.object({ token: tokenSchema }));
  await prisma.pushToken.deleteMany({ where: { token, userId: user.id } });
  return ok({ removed: true });
});
