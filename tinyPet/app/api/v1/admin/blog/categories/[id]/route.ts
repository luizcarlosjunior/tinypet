import { handler, ok, parseBody, audit, clientIp } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { categoryPatchSchema, deleteCategory, updateCategory } from "@/server/blog/categories";
import { revalidateBlog } from "@/server/blog/revalidate";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireBlogEditor(req);
  const body = await parseBody(req, categoryPatchSchema);
  const c = await updateCategory(params.id, body);
  await audit({ userId: user.id, action: "blog.category.update", entity: "BlogCategory", entityId: c.id, data: body, ip: clientIp(req) });
  revalidateBlog();
  return ok(c);
});

/** DELETE /admin/blog/categories/:id — 409 with children or posts (`?force=1` unlinks posts). */
export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireBlogEditor(req);
  const r = await deleteCategory(params.id, req.nextUrl.searchParams.get("force") === "1");
  await audit({ userId: user.id, action: "blog.category.delete", entity: "BlogCategory", entityId: params.id, data: r, ip: clientIp(req) });
  revalidateBlog();
  return ok(r);
});
