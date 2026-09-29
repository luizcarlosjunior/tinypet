import { handler, ok, requireUser, revokeMobileTokens, Errors } from "@/server";

/** POST /auth/logout (Bearer) → bumps tokenVersion, invalidating ALL mobile tokens of the user. */
export const POST = handler(async (req) => {
  if (!req.headers.get("authorization")?.startsWith("Bearer ")) throw Errors.badRequest("Use o token Bearer do app para sair");
  const user = await requireUser(req);
  await revokeMobileTokens(user.id);
  return ok({ loggedOut: true });
});
