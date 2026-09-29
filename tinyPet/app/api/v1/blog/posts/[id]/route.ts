import { handler, ok, getUser, Errors } from "@/server";
import { getPublicPost } from "@/server/blog/posts";
import { isBlogEditor } from "@/server/blog/auth";

/** GET /blog/posts/:slug (slug or id) → full post + viewerHearted; old slug → { redirectTo }. `?preview=1` for blog editors. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const user = await getUser(req);
  const preview = req.nextUrl.searchParams.get("preview") === "1" && isBlogEditor(user);
  const r = await getPublicPost(params.id, { viewerId: user?.id, preview });
  if (!r) throw Errors.notFound("Post não encontrado");
  if ("redirectTo" in r) return ok({ redirectTo: r.redirectTo });
  return ok(r.post);
});

export const dynamic = "force-dynamic";
