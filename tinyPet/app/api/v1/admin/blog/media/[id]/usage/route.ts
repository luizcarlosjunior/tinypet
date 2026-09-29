import { handler, ok } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { getMediaUsage } from "@/server/blog/media";

/** GET /admin/blog/media/:id/usage → [{ postId, title, slug, status, field }] */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await requireBlogEditor(req);
  return ok(await getMediaUsage(params.id));
});
