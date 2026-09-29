import { z } from "zod";
import { prisma } from "@/db";
import { historyEventSchema } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, serialize } from "@/server";
import { petActor, jsonInput } from "@/server/pets";
import { petTimeline } from "@/server/timeline";

const query = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) });

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  const { limit } = parseQuery(req, query);
  return ok(serialize(await petTimeline(params.id, limit)));
});

/** Owner/family (EDIT) or linked partner adds an event (notes, attachments such as prescriptions). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  const body = await parseBody(req, historyEventSchema);
  const event = await prisma.petHistoryEvent.create({
    data: {
      petId: params.id,
      type: body.type,
      title: body.title,
      description: body.description ?? null,
      occurredAt: new Date(body.occurredAt),
      attachments: jsonInput(body.attachments ?? null),
      partnerId: actor.via === "partner" ? actor.partnerId : null,
      userId: actor.via === "partner" ? null : actor.user.id,
    },
    include: { partner: { select: { id: true, tradeName: true } }, user: { select: { id: true, name: true } } },
  });
  return ok(event, { status: 201 });
});
