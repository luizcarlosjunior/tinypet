import { prisma } from "@tinypet/db";
import { handler, ok, Errors, notifyPartner } from "@/server";
import { petActor } from "@/server/pets";

/** PROPOSED → ACTIVE (tutor accepts a partner's routine). */
export const POST = handler<{ id: string; tid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via === "partner") throw Errors.forbidden("Só o tutor aceita rotinas propostas");
  const task = await prisma.task.findFirst({ where: { id: params.tid, petId: params.id } });
  if (!task) throw Errors.notFound("Tarefa não encontrada");
  if (task.status !== "PROPOSED") throw Errors.conflict("A tarefa não está aguardando aceite");
  const updated = await prisma.task.update({ where: { id: task.id }, data: { status: "ACTIVE" } });
  if (task.proposedByPartnerId) await notifyPartner(task.proposedByPartnerId, { type: "task_accepted", title: `${actor.user.name} aceitou a rotina "${task.title}"`, data: { petId: params.id, taskId: task.id } });
  return ok(updated);
});
