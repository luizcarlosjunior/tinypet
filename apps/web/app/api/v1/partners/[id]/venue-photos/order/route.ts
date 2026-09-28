import { z } from "zod";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { reorderVenuePhotos } from "@/server/partners";

export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  const { ids } = await parseBody(req, z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(50) }));
  return ok(await reorderVenuePhotos(ctx.partnerId, ids));
});
