import { handler, ok, parseBody, audit, clientIp } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { getAdminPost, postPatchSchema, softDeletePost, updatePost } from "@/server/blog/posts";
import { revalidateBlog } from "@/server/blog/revalidate";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await requireBlogEditor(req);
  return ok(await getAdminPost(params.id));
});

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireBlogEditor(req);
  const body = await parseBody(req, postPatchSchema);
  const { post, previousSlug } = await updatePost(params.id, body);
  await audit({ userId: user.id, action: "blog.post.update", entity: "BlogPost", entityId: post.id, data: { fields: Object.keys(body), status: post.status, ...(previousSlug !== post.slug ? { previousSlug, slug: post.slug } : {}) }, ip: clientIp(req) });
  revalidateBlog();
  return ok(post);
});

/** DELETE /admin/blog/posts/:id — soft delete. */
export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireBlogEditor(req);
  const r = await softDeletePost(params.id);
  await audit({ userId: user.id, action: "blog.post.delete", entity: "BlogPost", entityId: r.id, ip: clientIp(req) });
  revalidateBlog();
  return ok({ id: r.id, deleted: true });
});
