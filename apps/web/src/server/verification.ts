import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@tinypet/db";
import { sendMail, layout } from "./mail";
import { Errors } from "./errors";

type Channel = "EMAIL" | "PHONE";

const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

export function hashCode(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}

function sameHash(aHex: string, bHex: string) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Creates a 6-digit code (stored as sha256), invalidates previous unused codes for the same user+channel+target
 * and delivers it. The plaintext code is never persisted nor logged in production.
 */
export async function sendVerificationCode(userId: string, channel: Channel, target: string) {
  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  await prisma.$transaction([
    prisma.verificationCode.updateMany({ where: { userId, channel, target, usedAt: null }, data: { usedAt: now } }),
    prisma.verificationCode.create({ data: { userId, channel, target, code: hashCode(code), expiresAt: new Date(now.getTime() + CODE_TTL_MS) } }),
  ]);
  if (channel === "EMAIL") {
    await sendMail(target, "Seu código de verificação tinyPet", layout("Confirme seu e-mail", `<p>Seu código é <strong style="font-size:22px">${code}</strong>. Ele vale por 15 minutos.</p>`), `Código: ${code}`);
  } else if (process.env.NODE_ENV === "production") {
    // WhatsApp/SMS provider: phase 2. Never log the code in production.
    console.warn(`[sms] provider not configured; code for user ${userId} not delivered`);
  } else {
    console.log(`[sms][dev] to=${target} code=${code}`);
  }
}

/**
 * Validates a code against the LATEST unused, unexpired code for user+channel (restricted to `targets` when given).
 * Every attempt increments `attempts`; after MAX_CODE_ATTEMPTS the code is invalidated.
 * Returns the row's target on success (row is marked used).
 */
export async function consumeVerificationCode(userId: string, channel: Channel, code: string, targets?: string[]) {
  if (targets && !targets.length) throw Errors.badRequest("Código inválido ou expirado");
  const now = new Date();
  const row = await prisma.verificationCode.findFirst({
    where: { userId, channel, usedAt: null, expiresAt: { gt: now }, ...(targets ? { target: { in: targets } } : {}) },
    orderBy: { createdAt: "desc" },
  });
  if (!row) throw Errors.badRequest("Código inválido ou expirado");
  const updated = await prisma.verificationCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
  if (updated.attempts > MAX_CODE_ATTEMPTS) {
    await prisma.verificationCode.update({ where: { id: row.id }, data: { usedAt: now } });
    throw Errors.badRequest("Muitas tentativas com este código. Solicite um novo.");
  }
  if (!/^\d{6}$/.test(code.trim()) || !sameHash(hashCode(code), row.code)) throw Errors.badRequest("Código inválido ou expirado");
  // Atomic "mark used" so two concurrent correct submissions can't both succeed.
  const r = await prisma.verificationCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (r.count !== 1) throw Errors.badRequest("Código inválido ou expirado");
  return row.target;
}

/** Targets the user may verify for a channel: login e-mail + own Email rows / own Phone rows. */
export async function userVerificationTargets(userId: string, channel: Channel) {
  if (channel === "EMAIL") {
    const [u, emails] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      prisma.email.findMany({ where: { userId }, select: { address: true } }),
    ]);
    return Array.from(new Set([...(u ? [u.email] : []), ...emails.map((e) => e.address)]));
  }
  return (await prisma.phone.findMany({ where: { userId }, select: { number: true } })).map((p) => p.number);
}

export async function confirmVerificationCode(userId: string, channel: Channel, code: string) {
  const targets = await userVerificationTargets(userId, channel);
  const target = await consumeVerificationCode(userId, channel, code, targets);
  const now = new Date();
  if (channel === "EMAIL") {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (u && u.email.toLowerCase() === target.toLowerCase()) await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: now } });
    await prisma.email.updateMany({ where: { userId, address: target }, data: { verifiedAt: now } });
  } else {
    await prisma.phone.updateMany({ where: { userId, number: target }, data: { verifiedAt: now } });
  }
  return target;
}
