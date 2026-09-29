import { handler, ok, parseBody, audit, clientIp } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { commentModerationSchema, moderateComment } from "@/server/blog/comments";

/** POST /admin/blog/comments/:id { action: HIDE | RESTORE | DELETE | DISMISS_REPORTS } */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireBlogEditor(req);
  const { action } = await parseBody(req, commentModerationSchema);
  const r = await moderateComment(params.id, action);
  await audit({ userId: user.id, action: `blog.comment.${action.toLowerCase()}`, entity: "BlogComment", entityId: params.id, ip: clientIp(req) });
  return ok(r);
});
