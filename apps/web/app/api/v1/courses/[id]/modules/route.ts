import { z } from "zod";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { createModule } from "@/server/courses";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const { title } = await parseBody(req, z.object({ title: z.string().min(1).max(120) }));
  return ok(await createModule(ctx.partnerId, params.id, title), { status: 201 });
});
