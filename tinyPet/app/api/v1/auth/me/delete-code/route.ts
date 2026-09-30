import { handler, ok, requireUser } from "@/server";
import { sendReauthCode } from "@/server/reauth";

/** POST /auth/me/delete-code — e-mails the confirmation code for deleting an account without password (Google/Apple). */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  return ok(await sendReauthCode(user.id, "account_delete"));
});
