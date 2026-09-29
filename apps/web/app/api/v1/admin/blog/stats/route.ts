import { handler, ok, parseQuery } from "@/server";
import { requireBlogEditor } from "@/server/blog/auth";
import { blogStats, statsQuerySchema } from "@/server/blog/stats";

/** GET /admin/blog/stats?period=7d|30d|90d|12m|custom&from&to&postId&categoryId */
export const GET = handler(async (req) => {
  await requireBlogEditor(req);
  return ok(await blogStats(parseQuery(req, statsQuerySchema)));
});

export const dynamic = "force-dynamic";
