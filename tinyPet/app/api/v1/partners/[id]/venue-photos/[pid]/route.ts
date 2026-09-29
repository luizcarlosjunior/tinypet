import { venuePhotoSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { updateVenuePhoto, deleteVenuePhoto } from "@/server/partners";

export const PATCH = handler<{ id: string; pid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  const body = await parseBody(req, venuePhotoSchema.partial());
  return ok(await updateVenuePhoto(ctx.partnerId, params.pid, body));
});

export const DELETE = handler<{ id: string; pid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  await deleteVenuePhoto(ctx.partnerId, params.pid);
  return ok({ deleted: true });
});
