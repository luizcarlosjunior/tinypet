import { lessonProgressSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser } from "@/server";
import { updateLessonProgress } from "@/server/courses";

/** Marks a lesson complete / asks a question. Completing a lesson with an exercise proposes a Task for each enrolled pet. */
export const POST = handler<{ enrollmentId: string; lid: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const input = await parseBody(req, lessonProgressSchema);
  return ok(await updateLessonProgress(user, params.enrollmentId, params.lid, input));
});
