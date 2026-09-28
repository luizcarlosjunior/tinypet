import { handler, ok, requireUser, serialize } from "@/server";
import { listMyReviews } from "@/server/ratings";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(serialize(await listMyReviews(user.id)));
});
