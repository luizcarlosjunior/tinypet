import { handler, ok, parseBody, requireUser } from "@/server";
import { commentReportSchema, reportComment } from "@/server/blog/comments";

/** POST /blog/comments/:id/report { reason } (auth, once per user). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const { reason } = await parseBody(req, commentReportSchema);
  return ok(await reportComment(params.id, reason, user), { status: 201 });
});
