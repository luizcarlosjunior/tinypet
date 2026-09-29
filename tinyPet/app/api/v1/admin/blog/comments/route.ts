import { handler, ok, parseQuery } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { adminCommentListSchema, listAdminComments } from "@/server/blog/comments";

/** GET /admin/blog/comments?status&postId&reported=1&q&page&pageSize */
export const GET = handler(async (req) => {
  await requireBlogEditor(req);
  const { items, meta } = await listAdminComments(parseQuery(req, adminCommentListSchema));
  return ok(items, { meta });
});
