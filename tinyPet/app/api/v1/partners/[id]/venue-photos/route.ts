import { venuePhotoSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { listVenuePhotos, addVenuePhoto } from "@/server/partners";
import { assertOwnMediaUrls } from "@/server/media";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  return ok(await listVenuePhotos(ctx.partnerId));
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  const body = await parseBody(req, venuePhotoSchema);
  await assertOwnMediaUrls([body.url, body.thumbUrl], ctx.user.id);
  return ok(await addVenuePhoto(ctx.partnerId, body), { status: 201 });
});
