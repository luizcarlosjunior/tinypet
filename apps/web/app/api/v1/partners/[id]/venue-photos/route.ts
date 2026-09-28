import { venuePhotoSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { listVenuePhotos, addVenuePhoto } from "@/server/partners";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  return ok(await listVenuePhotos(ctx.partnerId));
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  const body = await parseBody(req, venuePhotoSchema);
  return ok(await addVenuePhoto(ctx.partnerId, body), { status: 201 });
});
