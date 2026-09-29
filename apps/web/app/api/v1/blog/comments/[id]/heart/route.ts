import { handler, ok, requireUser } from "@/server";
import { toggleCommentHeart } from "@/server/blog/hearts";

/** POST /blog/comments/:id/heart → toggle → { hearted, heartsCount }. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  return ok(await toggleCommentHeart(params.id, user.id));
});
