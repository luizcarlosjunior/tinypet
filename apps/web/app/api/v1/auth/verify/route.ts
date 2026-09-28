import { z } from "zod";
import { prisma } from "@tinypet/db";
import { verifyCodeSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, rateLimit, Errors } from "@/server";
import { sendVerificationCode, confirmVerificationCode } from "@/server/verification";

/** POST { channel, target? } => sends a code. PUT { channel, code } => confirms. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  rateLimit(`verify:${user.id}`, 5, 15 * 60 * 1000);
  const { channel, target } = await parseBody(req, z.object({ channel: z.enum(["EMAIL", "PHONE"]), target: z.string().optional() }));
  let dest = target;
  if (!dest) {
    if (channel === "EMAIL") dest = user.email;
    else dest = (await prisma.phone.findFirst({ where: { userId: user.id, isPrimary: true } }))?.number ?? (await prisma.phone.findFirst({ where: { userId: user.id } }))?.number ?? undefined;
  }
  if (!dest) throw Errors.badRequest("Cadastre um telefone antes de verificar");
  await sendVerificationCode(user.id, channel, dest);
  return ok({ sent: true, channel, target: dest });
});

export const PUT = handler(async (req) => {
  const user = await requireUser(req);
  const { channel, code } = await parseBody(req, verifyCodeSchema);
  const target = await confirmVerificationCode(user.id, channel, code);
  return ok({ verified: true, channel, target });
});
