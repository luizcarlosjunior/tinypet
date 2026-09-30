import { prisma } from "@/db";
import { formatAge } from "@tinypet/shared";
import { Errors } from "./errors";
import { petAgeMonths } from "./pets";

/**
 * Public pet profile (/pet/<slug>), only when the owner enabled it. Exposes the basics (name, photo, species, breed,
 * age), PUBLIC gallery items, earned badges, mastered skills and social profiles — never microchip, health data,
 * addresses or anything about the owner.
 */
export async function publicPetProfile(slug: string) {
  const pet = await prisma.pet.findFirst({
    where: { publicSlug: slug, publicProfile: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      sex: true,
      status: true,
      deceasedAt: true,
      birthDate: true,
      approxAgeMonths: true,
      breedOther: true,
      species: { select: { key: true, label: true } },
      breed: { select: { name: true, isMixed: true } },
      media: { where: { visibility: "PUBLIC", isStory: false, deletedAt: null }, orderBy: { takenAt: "desc" }, take: 60, select: { id: true, kind: true, url: true, thumbUrl: true, title: true, description: true, takenAt: true } },
      earnedBadges: { orderBy: { earnedAt: "desc" }, select: { earnedAt: true, badge: { select: { key: true, name: true, description: true, iconUrl: true } } } },
      skills: { where: { level: "MASTERED" }, select: { masteredAt: true, skill: { select: { name: true } } } },
      socialProfiles: { orderBy: { network: "asc" }, select: { network: true, username: true } },
    },
  });
  if (!pet) throw Errors.notFound("Perfil não encontrado ou não é público");
  const months = petAgeMonths(pet);
  const { id: _id, birthDate: _b, approxAgeMonths: _a, ...rest } = pet;
  return {
    ...rest,
    breed: pet.breed ? (pet.breed.isMixed ? "SRD" : pet.breed.name) : pet.breedOther,
    ageLabel: pet.status === "DECEASED" ? null : months != null ? formatAge(months) : null,
    badges: pet.earnedBadges.map((b) => ({ ...b.badge, earnedAt: b.earnedAt })),
    skills: pet.skills.map((s) => s.skill.name),
    earnedBadges: undefined,
  };
}
