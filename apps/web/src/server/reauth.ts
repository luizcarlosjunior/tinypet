import { randomInt } from "node:crypto";
import { verify } from "@node-rs/argon2";
import { prisma } from "@tinypet/db";
import { Errors } from "./errors";
import { rateLimit } from "./api";
import { sendMail, layout, escapeHtml } from "./mail";
import { consumeVerificationCode, hashCode } from "./verification";

/**
 * Step-up confirmation for sensitive, irreversible actions (e.g. registering a pet's death).
 * Accounts with a password confirm with it; OAuth-only accounts (Google/Apple, no password) confirm with a
 * one-time code sent to the login e-mail. Codes are scoped to the action (target `action:<name>`), so they can't
 * be used to verify e-mails or for other actions.
 */
export type ReauthAction = "pet_deceased" | "pet_transfer";

const ACTION_LABEL: Record<ReauthAction, string> = { pet_deceased: "registrar o falecimento de um pet", pet_transfer: "transferir a propriedade de um pet" };
const CODE_TTL_MS = 10 * 60 * 1000;

function actionTarget(action: ReauthAction) {
  return `action:${action}`;
}

export async function userHasPassword(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  return !!u?.passwordHash;
}

/** Sends a confirmation code by e-mail. Only for accounts without a password. */
export async function sendReauthCode(userId: string, action: ReauthAction) {
  await rateLimit(`reauth:send:${userId}`, 3, 15 * 60 * 1000);
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, passwordHash: true } });
  if (!u) throw Errors.unauthorized();
  if (u.passwordHash) throw Errors.badRequest("Confirme com a sua senha.");
  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  const target = actionTarget(action);
  await prisma.$transaction([
    prisma.verificationCode.updateMany({ where: { userId, channel: "EMAIL", target, usedAt: null }, data: { usedAt: now } }),
    prisma.verificationCode.create({ data: { userId, channel: "EMAIL", target, code: hashCode(code), expiresAt: new Date(now.getTime() + CODE_TTL_MS) } }),
  ]);
  const label = ACTION_LABEL[action];
  await sendMail(
    u.email,
    "Código de confirmação tinyPet",
    layout("Confirme esta ação", `<p>Use o código <strong style="font-size:22px">${code}</strong> para ${escapeHtml(label)}. Ele vale por 10 minutos.</p><p>Se não foi você, ignore este e-mail e troque o acesso da sua conta.</p>`),
    `Código para ${label}: ${code}`,
  );
  return { sent: true };
}

/** Throws 401/400 unless the user proved their identity for `action` (password, or e-mail code when no password). */
export async function assertReauth(userId: string, action: ReauthAction, proof: { password?: string | null; code?: string | null }) {
  await rateLimit(`reauth:try:${userId}`, 5, 15 * 60 * 1000);
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!u) throw Errors.unauthorized();
  if (u.passwordHash) {
    if (!proof.password) throw Errors.badRequest("Digite a sua senha para confirmar.", { reason: "PASSWORD_REQUIRED" });
    const ok = await verify(u.passwordHash, proof.password).catch(() => false);
    if (!ok) throw Errors.badRequest("Senha incorreta.", { reason: "PASSWORD_INVALID" });
    return;
  }
  if (!proof.code) throw Errors.badRequest("Digite o código enviado ao seu e-mail.", { reason: "CODE_REQUIRED" });
  await consumeVerificationCode(userId, "EMAIL", proof.code, [actionTarget(action)]);
}
