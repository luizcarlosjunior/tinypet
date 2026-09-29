import { prisma } from "@/db";
import { notify } from "./notify";

/**
 * Awards a badge (by key) to a pet. Idempotent; returns true only when newly earned.
 * Deceased pets never earn new badges (memorial).
 */
export async function awardBadge(petId: string, key: string): Promise<boolean> {
  const [badge, pet] = await Promise.all([
    prisma.badge.findUnique({ where: { key } }),
    prisma.pet.findFirst({ where: { id: petId, deletedAt: null }, select: { id: true, name: true, ownerId: true, status: true } }),
  ]);
  if (!badge || !pet || pet.status !== "ACTIVE") return false;
  const existing = await prisma.earnedBadge.findUnique({ where: { badgeId_petId: { badgeId: badge.id, petId } } });
  if (existing) return false;
  await prisma.earnedBadge.create({ data: { badgeId: badge.id, petId } });
  if (pet.ownerId) {
    await notify({
      userId: pet.ownerId,
      type: "badge_earned",
      title: `${pet.name} ganhou a conquista "${badge.name}"`,
      body: badge.description ?? undefined,
      data: { petId, badgeKey: key },
    });
  }
  return true;
}

/** All system badges (+ partner badges already earned) with the earned status for a pet. */
export async function petBadges(petId: string) {
  const [badges, earned] = await Promise.all([
    prisma.badge.findMany({ where: { partnerId: null }, orderBy: { name: "asc" } }),
    prisma.earnedBadge.findMany({ where: { petId }, include: { badge: { include: { partner: { select: { id: true, tradeName: true } } } } } }),
  ]);
  const earnedById = new Map(earned.map((e) => [e.badgeId, e]));
  const system = badges.map((b) => ({
    id: b.id,
    key: b.key,
    name: b.name,
    description: b.description,
    iconUrl: b.iconUrl,
    system: true,
    partner: null as { id: string; tradeName: string } | null,
    earned: earnedById.has(b.id),
    earnedAt: earnedById.get(b.id)?.earnedAt ?? null,
  }));
  const partnerBadges = earned
    .filter((e) => e.badge.partnerId)
    .map((e) => ({
      id: e.badge.id,
      key: e.badge.key,
      name: e.badge.name,
      description: e.badge.description,
      iconUrl: e.badge.iconUrl,
      system: false,
      partner: e.badge.partner ? { id: e.badge.partner.id, tradeName: e.badge.partner.tradeName } : null,
      earned: true,
      earnedAt: e.earnedAt,
    }));
  return [...system, ...partnerBadges];
}
