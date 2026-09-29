import { handler, ok, requireUser } from "@/server";
import { togglePostHeart } from "@/server/blog/hearts";

/** POST /blog/posts/:id/heart → toggle → { hearted, heartsCount }. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  return ok(await togglePostHeart(params.id, user.id));
});
