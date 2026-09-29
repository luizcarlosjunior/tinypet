import { handler, ok, parseQuery } from "@/server";
import { listPublicPosts, publicPostListSchema } from "@/server/blog/posts";

/** GET /blog/posts?category&tag&q&featured&page&pageSize → published posts (paginated). */
export const GET = handler(async (req) => {
  const q = parseQuery(req, publicPostListSchema);
  const { items, meta, category } = await listPublicPosts(q);
  return ok(items, { meta: { ...meta, ...(category ? { category } : {}) } });
});
