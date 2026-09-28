import { reviewSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { upsertItemReview } from "@/server/ratings";

export const POST = handler<{ itemId: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const input = await parseBody(req, reviewSchema);
  return ok(serialize(await upsertItemReview(user.id, params.itemId, input)), { status: 201 });
});
