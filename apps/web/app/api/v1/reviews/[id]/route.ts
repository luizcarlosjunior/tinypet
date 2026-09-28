import { handler, ok, requireUser } from "@/server";
import { deleteOwnReview } from "@/server/ratings";

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  await deleteOwnReview(user.id, params.id);
  return ok({ deleted: true });
});
