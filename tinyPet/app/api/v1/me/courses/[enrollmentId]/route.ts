import { handler, ok, requireUser, serialize } from "@/server";
import { getMyEnrollment } from "@/server/courses";

export const GET = handler<{ enrollmentId: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  return ok(serialize(await getMyEnrollment(user.id, params.enrollmentId)));
});
