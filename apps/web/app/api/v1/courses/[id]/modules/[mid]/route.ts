import { z } from "zod";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { updateModule, deleteModule } from "@/server/courses";

export const PATCH = handler<{ id: string; mid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const body = await parseBody(req, z.object({ title: z.string().min(1).max(120).optional(), sortOrder: z.number().int().min(0).optional() }));
  return ok(await updateModule(ctx.partnerId, params.id, params.mid, body));
});

export const DELETE = handler<{ id: string; mid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  await deleteModule(ctx.partnerId, params.id, params.mid);
  return ok({ deleted: true });
});
