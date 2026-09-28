import { lessonSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { updateLesson, deleteLesson } from "@/server/courses";

export const PATCH = handler<{ id: string; lid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const input = await parseBody(req, lessonSchema.partial());
  return ok(await updateLesson(ctx.partnerId, params.id, params.lid, input));
});

export const DELETE = handler<{ id: string; lid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  await deleteLesson(ctx.partnerId, params.id, params.lid);
  return ok({ deleted: true });
});
