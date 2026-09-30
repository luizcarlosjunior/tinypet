import { courseSchema } from "@tinypet/shared";
import { prisma } from "@/db";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { getCourse, updateCourse, deleteCourse } from "@/server/courses";
import { assertOwnMediaUrls } from "@/server/media";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  return ok(serialize(await getCourse(ctx.partnerId, params.id)));
});

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const input = await parseBody(req, courseSchema.partial());
  if (input.coverUrl) {
    const cur = await prisma.course.findFirst({ where: { id: params.id, partnerId: ctx.partnerId }, select: { coverUrl: true } });
    await assertOwnMediaUrls([input.coverUrl], ctx.user.id, [cur?.coverUrl]);
  }
  return ok(serialize(await updateCourse(ctx.partnerId, params.id, input)));
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  return ok({ deleted: true, ...(await deleteCourse(ctx.partnerId, params.id)) });
});
