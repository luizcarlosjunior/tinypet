import { handler, ok, parseQuery } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { listBlogMedia, mediaListSchema, uploadBlogMedia } from "@/server/blog/media";

/** GET /admin/blog/media?q&type&inUse=0|1&trash=0|1&page&pageSize */
export const GET = handler(async (req) => {
  await requireBlogEditor(req);
  const { items, meta } = await listBlogMedia(parseQuery(req, mediaListSchema));
  return ok(items, { meta });
});

/** POST /admin/blog/media multipart `file` (+ optimize=true, format=webp|png, quality=1..100, alt). */
export const POST = handler(async (req) => {
  const user = await requireBlogEditor(req);
  return ok(await uploadBlogMedia(req, user.id), { status: 201 });
});

export const dynamic = "force-dynamic";
