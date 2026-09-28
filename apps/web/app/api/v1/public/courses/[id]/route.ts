import { handler, ok, serialize } from "@/server";
import { getPublicCourse } from "@/server/public";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  return ok(serialize(await getPublicCourse(params.id)));
});
