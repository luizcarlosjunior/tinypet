import { z } from "zod";
import { prisma } from "@tinypet/db";
import { taskSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor, jsonInput } from "@/server/pets";

const patchSchema = taskSchema.partial().extend({ status: z.enum(["ACTIVE", "PAUSED", "DONE"]).optional() });

export const PATCH = handler<{ id: string; tid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const task = await prisma.task.findFirst({ where: { id: params.tid, petId: params.id } });
  if (!task) throw Errors.notFound("Tarefa não encontrada");
  if (actor.via === "partner" && task.proposedByPartnerId !== actor.partnerId) throw Errors.forbidden("Só é possível editar tarefas propostas pelo seu parceiro");
  const body = await parseBody(req, patchSchema);
  return ok(
    await prisma.task.update({
      where: { id: task.id },
      data: { title: body.title, description: body.description, rule: jsonInput(body.rule), dueAt: body.dueAt === undefined ? undefined : body.dueAt ? new Date(body.dueAt) : null, status: body.status },
    }),
  );
});

export const DELETE = handler<{ id: string; tid: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const task = await prisma.task.findFirst({ where: { id: params.tid, petId: params.id } });
  if (!task) throw Errors.notFound("Tarefa não encontrada");
  if (actor.via === "partner" && task.proposedByPartnerId !== actor.partnerId) throw Errors.forbidden("Só é possível remover tarefas propostas pelo seu parceiro");
  await prisma.task.delete({ where: { id: task.id } });
  return ok({ deleted: true });
});
