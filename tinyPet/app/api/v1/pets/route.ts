import { z } from "zod";
import { prisma, type Prisma } from "@/db";
import { petSchema } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, requireUser, assertLimit } from "@/server";
import { myPetsWhere, ownerPetCount, petData, petInclude, lifeStageRules, petLifeStageSync, petAgeMonths, ensurePublicSlug } from "@/server/pets";
import { awardBadge } from "@/server/badges";
import { formatAge } from "@tinypet/shared";

const query = z.object({ includeDeceased: z.coerce.boolean().optional() });

/** Mine + shared via PetAccess. */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const { includeDeceased } = parseQuery(req, query);
  const [pets, rules] = await Promise.all([
    prisma.pet.findMany({
      where: myPetsWhere(user.id, !!includeDeceased),
      include: { ...petInclude, _count: { select: { earnedBadges: true, media: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    lifeStageRules(),
  ]);
  return ok(
    pets.map((p) => {
      const months = petAgeMonths(p);
      const owner = p.ownerId === user.id;
      // `access` kept for compatibility (shared accounts are always read-only); `role` is the new field
      return { ...p, ageMonths: months, ageLabel: formatAge(months), lifeStage: petLifeStageSync(p, rules), access: owner ? "OWNER" : "VIEW", role: owner ? "owner" : "shared" };
    }),
  );
});

/** Free limit counts only pets created by the tutor (createdByPartnerId null) that are ACTIVE. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, petSchema);
  await assertLimit("OWNER", user.id, "owner_pets", await ownerPetCount(user.id));
  const data = await petData(body);
  const pet = await prisma.pet.create({ data: { ...(data as Prisma.PetUncheckedCreateInput), name: body.name, speciesId: data.speciesId as string, ownerId: user.id }, include: petInclude });
  if (pet.avatarUrl) await awardBadge(pet.id, "first_steps");
  if (pet.publicProfile) {
    await ensurePublicSlug(pet.id);
    return ok(await prisma.pet.findUniqueOrThrow({ where: { id: pet.id }, include: petInclude }), { status: 201 });
  }
  return ok(pet, { status: 201 });
});
