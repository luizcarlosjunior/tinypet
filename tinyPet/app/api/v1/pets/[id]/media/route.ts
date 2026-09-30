import { z } from "zod";
import { prisma, type MediaVisibility } from "@/db";
import { petMediaSchema } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, assertFeature, Errors } from "@/server";
import { petActor } from "@/server/pets";
import { awardBadge } from "@/server/badges";
import { assertOwnMediaUrls } from "@/server/media";

const query = z.object({ story: z.coerce.boolean().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30) });

/** `?story=true` → active stories (24h); otherwise the feed. Partners only see PARTNERS/PUBLIC items; family sees FAMILY+. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "VIEW");
  const q = parseQuery(req, query);
  const visible: MediaVisibility[] | undefined = actor.via === "owner" ? undefined : actor.via === "family" ? ["FAMILY", "PARTNERS", "PUBLIC"] : ["PARTNERS", "PUBLIC"];
  const visibility = visible ? { in: visible } : undefined;
  const where = { petId: params.id, deletedAt: null, ...(visibility ? { visibility } : {}), ...(q.story ? { isStory: true, expiresAt: { gt: new Date() } } : { isStory: false }) };
  const [total, items] = await Promise.all([
    prisma.petMedia.count({ where }),
    prisma.petMedia.findMany({ where, orderBy: { takenAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return ok(items, { meta: { page: q.page, pageSize: q.pageSize, total } });
});

/** Gallery requires `owner_gallery`; stories require `owner_stories` (owner's plan). Story expires 24h after takenAt. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.pet.status === "DECEASED" && actor.via !== "owner") throw Errors.forbidden("Perfil em memorial");
  const body = await parseBody(req, petMediaSchema);
  // only the tutor decides to publish the pet publicly
  if (actor.via === "partner" && body.visibility === "PUBLIC") throw Errors.forbidden("Somente o tutor pode deixar a mídia pública");
  const planOwnerId = actor.pet.ownerId ?? actor.user.id;
  await assertFeature("OWNER", planOwnerId, "owner_gallery");
  if (body.isStory) await assertFeature("OWNER", planOwnerId, "owner_stories");
  await assertOwnMediaUrls([body.url, body.thumbUrl], actor.user.id);
  // size comes from the stored asset (never trust the client value: it feeds storage quotas)
  const asset = await prisma.mediaAsset.findFirst({ where: { url: body.url, status: "READY" }, select: { sizeBytes: true } });
  const takenAt = new Date(body.takenAt);
  const media = await prisma.petMedia.create({
    data: {
      petId: params.id,
      kind: body.kind,
      url: body.url,
      thumbUrl: body.thumbUrl ?? null,
      title: body.title ?? null,
      description: body.description ?? null,
      notes: body.notes ?? null,
      takenAt,
      isStory: body.isStory,
      expiresAt: body.isStory ? new Date(takenAt.getTime() + 24 * 60 * 60 * 1000) : null,
      visibility: body.visibility,
      sizeBytes: asset?.sizeBytes ?? body.sizeBytes,
      uploadedByUserId: actor.via === "partner" ? null : actor.user.id,
      uploadedByPartnerId: actor.via === "partner" ? actor.partnerId : null,
    },
  });
  const galleryCount = await prisma.petMedia.count({ where: { petId: params.id, deletedAt: null, isStory: false } });
  if (galleryCount >= 50) await awardBadge(params.id, "photographer");
  return ok(media, { status: 201 });
});
