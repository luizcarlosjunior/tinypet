import { prisma } from "@tinypet/db";
import { sendMail, layout } from "./mail";
import { Errors } from "./errors";

export async function sendVerificationCode(userId: string, channel: "EMAIL" | "PHONE", target: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.verificationCode.create({ data: { userId, channel, target, code, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
  if (channel === "EMAIL") {
    await sendMail(target, "Seu código de verificação tinyPet", layout("Confirme seu e-mail", `<p>Seu código é <strong style="font-size:22px">${code}</strong>. Ele vale por 15 minutos.</p>`), `Código: ${code}`);
  } else {
    console.log(`[sms] to=${target} code=${code}`); // WhatsApp/SMS provider: phase 2
  }
  return code;
}

export async function confirmVerificationCode(userId: string, channel: "EMAIL" | "PHONE", code: string) {
  const row = await prisma.verificationCode.findFirst({ where: { userId, channel, code, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!row) throw Errors.badRequest("Código inválido ou expirado");
  await prisma.verificationCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  if (channel === "EMAIL") {
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    await prisma.email.updateMany({ where: { userId, address: row.target }, data: { verifiedAt: new Date() } });
  } else {
    await prisma.phone.updateMany({ where: { userId, number: row.target }, data: { verifiedAt: new Date() } });
  }
  return row.target;
}
