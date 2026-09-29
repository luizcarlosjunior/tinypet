import { handler, ok } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { restoreMedia } from "@/server/blog/media";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  await requireBlogEditor(req);
  return ok(await restoreMedia(params.id));
});
