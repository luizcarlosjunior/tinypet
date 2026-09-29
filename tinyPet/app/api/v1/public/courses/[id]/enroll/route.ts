import { enrollSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { enroll } from "@/server/courses";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const { petIds } = await parseBody(req, enrollSchema);
  return ok(serialize(await enroll(user, params.id, petIds)), { status: 201 });
});
