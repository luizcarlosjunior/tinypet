import { z } from "zod";
import { taskSkipSchema } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, Errors } from "@/server";
import { petActor, skipTask, unskipTask, todaySP } from "@/server/pets";

/**
 * POST /pets/:id/tasks/:tid/skip { note, forDate? } — "não deu hoje" with the reason (owner or shared account).
 * The day doesn't break the pet's streak but doesn't add to it. 409 when that day is already DONE.
 */
export const POST = handler<{ id: string; tid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "TASK");
  if (actor.via === "partner") throw Errors.forbidden("Só o tutor ou as contas compartilhadas registram a rotina");
  const body = await parseBody(req, taskSkipSchema);
  return ok(await skipTask(params.tid, params.id, actor.user.id, body.forDate ?? todaySP(), body.note), { status: 201 });
});

const query = z.object({ forDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** DELETE /pets/:id/tasks/:tid/skip?forDate= — undoes the "não feita" mark (default today). */
export const DELETE = handler<{ id: string; tid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "TASK");
  if (actor.via === "partner") throw Errors.forbidden("Só o tutor ou as contas compartilhadas registram a rotina");
  const q = parseQuery(req, query);
  return ok(await unskipTask(params.tid, params.id, q.forDate ?? todaySP()));
});
