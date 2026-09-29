import { handler, ok, requireUser, serialize } from "@/server";
import { listMyEnrollments } from "@/server/courses";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(serialize(await listMyEnrollments(user.id)));
});
