import { lessonSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { listLessons, createLesson } from "@/server/courses";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  return ok(await listLessons(ctx.partnerId, params.id));
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const input = await parseBody(req, lessonSchema);
  return ok(await createLesson(ctx.partnerId, params.id, input), { status: 201 });
});
