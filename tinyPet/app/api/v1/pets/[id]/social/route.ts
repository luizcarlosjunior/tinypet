import { prisma } from "@/db";
import { petSocialProfilesSchema } from "@tinypet/shared";
import { handler, ok, parseBody } from "@/server";
import { assertOwnerControlled, petActor } from "@/server/pets";

const select = { network: true, username: true, updatedAt: true } as const;

/** GET /pets/:id/social → `[{ network, username, updatedAt }]` (anyone who can view the pet). */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  return ok(await prisma.petSocialProfile.findMany({ where: { petId: params.id }, select, orderBy: { network: "asc" } }));
});

/**
 * PUT /pets/:id/social (petSocialProfilesSchema) → replaces the list. Clients may send a profile URL or "@user";
 * only the normalized username is stored. Owner-controlled data: the owner, or the partner that created an ownerless pet.
 */
export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  assertOwnerControlled(actor, "Apenas o tutor pode alterar as redes sociais do pet");
  const { profiles } = await parseBody(req, petSocialProfilesSchema);
  const rows = await prisma.$transaction(async (tx) => {
    await tx.petSocialProfile.deleteMany({ where: { petId: params.id, network: { notIn: profiles.map((p) => p.network) } } });
    for (const p of profiles) {
      await tx.petSocialProfile.upsert({
        where: { petId_network: { petId: params.id, network: p.network } },
        create: { petId: params.id, network: p.network, username: p.username },
        update: { username: p.username },
      });
    }
    return tx.petSocialProfile.findMany({ where: { petId: params.id }, select, orderBy: { network: "asc" } });
  });
  return ok(rows);
});
