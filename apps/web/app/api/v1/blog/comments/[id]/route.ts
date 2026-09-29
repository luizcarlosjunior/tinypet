import { handler, ok, parseBody, requireUser } from "@/server";
import { commentPatchSchema, deleteComment, editComment } from "@/server/blog/comments";

/** PATCH /blog/comments/:id { body } (author). */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const { body } = await parseBody(req, commentPatchSchema);
  return ok(await editComment(params.id, body, user));
});

/** DELETE /blog/comments/:id (author or blog editor; soft). */
export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  return ok(await deleteComment(params.id, user));
});
