import { reviewSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { upsertCourseReview } from "@/server/ratings";

export const POST = handler<{ courseId: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const input = await parseBody(req, reviewSchema);
  return ok(serialize(await upsertCourseReview(user.id, params.courseId, input)), { status: 201 });
});
