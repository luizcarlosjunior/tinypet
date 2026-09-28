import { handler, ok, requirePartner, serialize } from "@/server";
import { listStudents } from "@/server/courses";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  return ok(serialize(await listStudents(ctx.partnerId, params.id)));
});
