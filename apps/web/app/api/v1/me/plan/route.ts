import { handler, ok, requireUser, ownerUsage } from "@/server";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(await ownerUsage(user.id));
});
