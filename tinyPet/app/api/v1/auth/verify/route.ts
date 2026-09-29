import { z } from "zod";
import { prisma } from "@/db";
import { verifyCodeSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, rateLimit, Errors } from "@/server";
import { sendVerificationCode, confirmVerificationCode, userVerificationTargets } from "@/server/verification";

/**
 * POST { channel, target? } => sends a code (5/15min per user). `target` must be the login e-mail / one of the user's
 * own Email rows (EMAIL) or one of the user's own Phone rows (PHONE).
 * PUT { channel, code } => confirms (10/15min per user; max 5 attempts per code).
 */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`verify:send:${user.id}`, 5, 15 * 60 * 1000);
  const { channel, target } = await parseBody(req, z.object({ channel: z.enum(["EMAIL", "PHONE"]), target: z.string().trim().max(191).optional() }));
  let dest = target;
  if (!dest) {
    if (channel === "EMAIL") dest = user.email;
    else dest = (await prisma.phone.findFirst({ where: { userId: user.id }, orderBy: { isPrimary: "desc" } }))?.number ?? undefined;
  }
  if (!dest) throw Errors.badRequest("Cadastre um telefone antes de verificar");
  const allowed = await userVerificationTargets(user.id, channel);
  const match = allowed.find((t) => (channel === "EMAIL" ? t.toLowerCase() === dest!.toLowerCase() : t === dest));
  if (!match) throw Errors.badRequest(channel === "EMAIL" ? "Este e-mail não pertence à sua conta" : "Este telefone não pertence à sua conta");
  await sendVerificationCode(user.id, channel, match);
  return ok({ sent: true, channel, target: match });
});

export const PUT = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`verify:confirm:${user.id}`, 10, 15 * 60 * 1000);
  const { channel, code } = await parseBody(req, verifyCodeSchema);
  const target = await confirmVerificationCode(user.id, channel, code);
  return ok({ verified: true, channel, target });
});
