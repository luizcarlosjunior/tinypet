import { venuePhotoSchema } from "@tinypet/shared";
import { prisma } from "@/db";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { assertOwnMediaUrls } from "@/server/media";
import { updateVenuePhoto, deleteVenuePhoto } from "@/server/partners";

export const PATCH = handler<{ id: string; pid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  const body = await parseBody(req, venuePhotoSchema.partial());
  if (body.url || body.thumbUrl) {
    const cur = await prisma.venuePhoto.findFirst({ where: { id: params.pid, partnerId: ctx.partnerId }, select: { url: true, thumbUrl: true } });
    await assertOwnMediaUrls([body.url, body.thumbUrl], ctx.user.id, [cur?.url, cur?.thumbUrl]);
  }
  return ok(await updateVenuePhoto(ctx.partnerId, params.pid, body));
});

export const DELETE = handler<{ id: string; pid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  await deleteVenuePhoto(ctx.partnerId, params.pid);
  return ok({ deleted: true });
});
