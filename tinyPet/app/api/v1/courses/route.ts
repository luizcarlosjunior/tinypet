import { courseSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { listCourses, createCourse } from "@/server/courses";
import { assertOwnMediaUrls } from "@/server/media";

export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  return ok(serialize(await listCourses(ctx.partnerId)));
});

export const POST = handler(async (req) => {
  const ctx = await requirePartner(req);
  const input = await parseBody(req, courseSchema);
  await assertOwnMediaUrls([input.coverUrl], ctx.user.id);
  return ok(serialize(await createCourse(ctx.partnerId, input)), { status: 201 });
});
