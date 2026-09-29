import { taskCompleteSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor, completeTask, todaySP } from "@/server/pets";

/** Owner or shared account (TASK level). Upserts the completion for `forDate` (default: today in America/Sao_Paulo) and updates the streak when the day is complete. */
export const POST = handler<{ id: string; tid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "TASK");
  if (actor.via === "partner") throw Errors.forbidden("Só o tutor ou as contas compartilhadas concluem tarefas");
  const body = await parseBody(req, taskCompleteSchema);
  return ok(await completeTask(params.tid, params.id, actor.user.id, body.forDate ?? todaySP()));
});
