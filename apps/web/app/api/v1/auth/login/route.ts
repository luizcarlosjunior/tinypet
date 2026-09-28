import { verify } from "@node-rs/argon2";
import { prisma } from "@tinypet/db";
import { loginSchema } from "@tinypet/shared";
import { handler, ok, parseBody, rateLimit, clientIp, issueMobileToken, sessionContext, Errors } from "@/server";

/** Mobile login: returns a JWT. Web uses NextAuth (/api/auth). */
export const POST = handler(async (req) => {
  rateLimit(`login:${clientIp(req)}`, 20, 15 * 60 * 1000);
  const { email, password } = await parseBody(req, loginSchema);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || user.deletedAt || !(await verify(user.passwordHash, password))) throw Errors.unauthorized("E-mail ou senha inválidos");
  const token = await issueMobileToken(user.id);
  const ctx = await sessionContext({ id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl });
  return ok({ token, ...ctx });
});
