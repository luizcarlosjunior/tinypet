import { handler, ok } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { estimateBlogMedia } from "@/server/blog/media";

/** POST /admin/blog/media/estimate multipart `file` (+ quality) → { pngSize, webpSize, width, height } (nothing saved). */
export const POST = handler(async (req) => {
  await requireBlogEditor(req);
  return ok(await estimateBlogMedia(req));
});
