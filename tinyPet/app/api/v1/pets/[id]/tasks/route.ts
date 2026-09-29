import { z } from "zod";
import { prisma } from "@/db";
import { taskSchema } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, notify } from "@/server";
import { petActor, jsonInput, tasksForDate, todaySP } from "@/server/pets";

const query = z.object({ status: z.enum(["PROPOSED", "ACTIVE", "PAUSED", "DONE"]).optional(), date: z.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** All tasks of the pet (optionally by status) plus `today`: the ones due on `date` (default today) with completion state. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  const q = parseQuery(req, query);
  const date = q.date ?? todaySP();
  const [tasks, due] = await Promise.all([
    prisma.task.findMany({
      where: { petId: params.id, ...(q.status ? { status: q.status } : { status: { not: "DONE" } }) },
      include: { proposedByPartner: { select: { id: true, tradeName: true } }, completions: { orderBy: { forDate: "desc" }, take: 7, include: { user: { select: { id: true, name: true } } } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    tasksForDate([params.id], date),
  ]);
  return ok({ date, tasks, today: due });
});

/** Owner/family create ACTIVE tasks; partners propose (PROPOSED) and the tutor accepts. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const body = await parseBody(req, taskSchema);
  const proposed = actor.via === "partner";
  const task = await prisma.task.create({
    data: {
      petId: params.id,
      title: body.title,
      description: body.description ?? null,
      rule: jsonInput(body.rule ?? null),
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      status: proposed ? "PROPOSED" : "ACTIVE",
      proposedByPartnerId: proposed ? actor.partnerId : null,
    },
    include: { proposedByPartner: { select: { id: true, tradeName: true } } },
  });
  if (proposed && actor.pet.ownerId) {
    await notify({ userId: actor.pet.ownerId, type: "task_proposed", title: `${task.proposedByPartner?.tradeName ?? "Parceiro"} sugeriu uma rotina para ${actor.pet.name}`, body: task.title, data: { petId: params.id, taskId: task.id } });
  }
  return ok(task, { status: 201 });
});
