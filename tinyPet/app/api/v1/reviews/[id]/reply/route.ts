import { reviewReplySchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser } from "@/server";
import { replyToReview } from "@/server/ratings";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const { body } = await parseBody(req, reviewReplySchema);
  return ok(await replyToReview(user.id, params.id, body), { status: 201 });
});
