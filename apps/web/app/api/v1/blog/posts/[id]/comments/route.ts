import { handler, ok, parseBody, parseQuery, getUser, requireUser } from "@/server";
import { commentCreateSchema, commentListSchema, createComment, listComments } from "@/server/blog/comments";

/** GET /blog/posts/:id/comments?cursor&limit → { items, nextCursor, commentsEnabled }. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const q = parseQuery(req, commentListSchema);
  const viewer = await getUser(req);
  return ok(await listComments(params.id, q, viewer));
});

/** POST /blog/posts/:id/comments { body, parentId? } (auth). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const body = await parseBody(req, commentCreateSchema);
  return ok(await createComment(params.id, body, user), { status: 201 });
});

export const dynamic = "force-dynamic";
