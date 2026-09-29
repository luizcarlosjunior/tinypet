import { hash } from "@node-rs/argon2";
import { prisma } from "@/db";
import { registerSchema } from "@tinypet/shared";
import { handler, ok, parseBody, rateLimit, clientIp, issueMobileToken, ensureDefaultSubscription, sessionContext, Errors } from "@/server";
import { sendVerificationCode } from "@/server/verification";
import { assertUsernameFree } from "@/server/sharing";

export const POST = handler(async (req) => {
  await rateLimit(`register:ip:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const body = await parseBody(req, registerSchema);
  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw Errors.conflict("Já existe uma conta com este e-mail");
  if (body.username) await assertUsernameFree(body.username);
  const termsVersion = ((await prisma.setting.findUnique({ where: { key: "terms_version" } }))?.value as string) ?? "1";
  const defaultTerm = await prisma.ownerTerm.findFirst({ where: { isDefault: true } });
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      username: body.username ?? null,
      passwordHash: await hash(body.password),
      ownerTermId: body.ownerTermId ?? defaultTerm?.id,
      marketingConsent: body.marketingConsent,
      termsVersion,
      termsAcceptedAt: new Date(),
      emails: { create: { address: body.email, isPrimary: true } },
    },
  });
  await ensureDefaultSubscription("OWNER", user.id);
  await sendVerificationCode(user.id, "EMAIL", user.email);
  const token = await issueMobileToken(user.id);
  const ctx = await sessionContext({ id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: null });
  return ok({ token, ...ctx }, { status: 201 });
});
