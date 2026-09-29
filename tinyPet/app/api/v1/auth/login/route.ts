import { loginSchema } from "@tinypet/shared";
import { handler, ok, parseBody, clientIp, issueMobileToken, sessionContext, verifyPasswordLogin, Errors } from "@/server";

/** Mobile login: returns a JWT. Web uses NextAuth (/api/auth). Rate limited per e-mail (10/15min) and per IP (50/15min). */
export const POST = handler(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const user = await verifyPasswordLogin(email, password, clientIp(req));
  if (!user) throw Errors.unauthorized("E-mail ou senha inválidos");
  const token = await issueMobileToken(user.id);
  const ctx = await sessionContext({ id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl });
  return ok({ token, ...ctx });
});
