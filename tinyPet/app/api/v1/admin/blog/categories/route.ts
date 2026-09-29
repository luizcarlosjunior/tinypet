import { handler, ok, parseBody, audit, clientIp } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { categoryCreateSchema, categoryTree, createCategory } from "@/server/blog/categories";
import { revalidateBlog } from "@/server/blog/revalidate";

/** GET /admin/blog/categories → full tree with post counts (non-deleted posts). */
export const GET = handler(async (req) => {
  await requireBlogEditor(req);
  return ok(await categoryTree());
});

/** POST /admin/blog/categories { name, slug?, description?, parentId?, sortOrder?, active? } */
export const POST = handler(async (req) => {
  const user = await requireBlogEditor(req);
  const body = await parseBody(req, categoryCreateSchema);
  const c = await createCategory(body);
  await audit({ userId: user.id, action: "blog.category.create", entity: "BlogCategory", entityId: c.id, data: body, ip: clientIp(req) });
  revalidateBlog();
  return ok(c, { status: 201 });
});
