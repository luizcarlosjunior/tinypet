import { revalidatePath } from "next/cache";
import { reviewSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { upsertCourseReview } from "@/server/ratings";

export const POST = handler<{ courseId: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const input = await parseBody(req, reviewSchema);
  const review = await upsertCourseReview(user.id, params.courseId, input);
  revalidatePath("/cursos/[id]", "page"); // SSR course page reads through the Next data cache
  return ok(serialize(review), { status: 201 });
});
