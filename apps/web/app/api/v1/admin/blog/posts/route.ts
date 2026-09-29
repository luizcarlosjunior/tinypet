import { handler, ok, parseBody, parseQuery, audit, clientIp } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { adminPostListSchema, createPost, listAdminPosts, postBodySchema } from "@/server/blog/posts";
import { revalidateBlog } from "@/server/blog/revalidate";

/** GET /admin/blog/posts?q&status&categoryId&authorId&page&pageSize */
export const GET = handler(async (req) => {
  await requireBlogEditor(req);
  const { items, meta } = await listAdminPosts(parseQuery(req, adminPostListSchema));
  return ok(items, { meta });
});

/** POST /admin/blog/posts — content sanitized server-side. */
export const POST = handler(async (req) => {
  const user = await requireBlogEditor(req);
  const body = await parseBody(req, postBodySchema);
  const post = await createPost(body, user.id);
  await audit({ userId: user.id, action: "blog.post.create", entity: "BlogPost", entityId: post.id, data: { title: post.title, status: post.status }, ip: clientIp(req) });
  revalidateBlog();
  return ok(post, { status: 201 });
});
