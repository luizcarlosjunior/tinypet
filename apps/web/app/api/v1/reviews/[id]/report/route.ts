import { reportSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser } from "@/server";
import { reportReview } from "@/server/ratings";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const { reason } = await parseBody(req, reportSchema);
  return ok(await reportReview(user.id, params.id, reason), { status: 201 });
});
