import { handler, ok, parseBody } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { mediaPatchSchema, softDeleteMedia, updateMediaAlt } from "@/server/blog/media";

/** PATCH /admin/blog/media/:id { alt } */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  await requireBlogEditor(req);
  const { alt } = await parseBody(req, mediaPatchSchema);
  return ok(await updateMediaAlt(params.id, alt));
});

/** DELETE /admin/blog/media/:id — soft (trash); 409 `details.usage` when in use unless `?force=1`. */
export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  await requireBlogEditor(req);
  return ok(await softDeleteMedia(params.id, req.nextUrl.searchParams.get("force") === "1"));
});
