import { lessonSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { listLessons, createLesson } from "@/server/courses";
import { assertOwnMediaUrls } from "@/server/media";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  return ok(await listLessons(ctx.partnerId, params.id));
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const input = await parseBody(req, lessonSchema);
  // videoUrl may be an external player link ("URL externa"); PDF attachments must be our uploads
  await assertOwnMediaUrls((input.attachments ?? []).map((a) => a.url), ctx.user.id);
  return ok(await createLesson(ctx.partnerId, params.id, input), { status: 201 });
});
