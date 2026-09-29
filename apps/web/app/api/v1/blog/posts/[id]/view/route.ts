import { handler, parseBody } from "@/server";
import { recordView, viewBodySchema } from "@/server/blog/views";

/** POST /blog/posts/:id/view { screenWidth, screenHeight, referrer? } → 204 (same-origin, bots ignored, 60/min per visitor). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  let body = {};
  if ((req.headers.get("content-type") ?? "").includes("application/json")) body = await parseBody(req, viewBodySchema);
  await recordView(req, params.id, viewBodySchema.parse(body));
  return new Response(null, { status: 204 });
});
