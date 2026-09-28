import { prisma } from "@tinypet/db";
import { handler, ok, requireUser, serialize } from "@/server";
import { myPetsWhere, tasksForDate, todaySP, petInclude } from "@/server/pets";

/** Owner home: today's tasks, upcoming appointments (7 days), recent badges, pets and overdue installments. */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const today = todaySP();
  const now = new Date();
  const pets = await prisma.pet.findMany({ where: myPetsWhere(user.id), include: { ...petInclude, _count: { select: { earnedBadges: true } } }, orderBy: { createdAt: "asc" } });
  const petIds = pets.map((p) => p.id);
  const [tasksToday, upcomingAppointments, recentBadges, overdueInstallments] = await Promise.all([
    tasksForDate(petIds, today),
    petIds.length
      ? prisma.appointment.findMany({
          where: { startsAt: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) }, status: { in: ["REQUESTED", "CONFIRMED"] }, pets: { some: { petId: { in: petIds } } } },
          include: { partner: { select: { id: true, slug: true, tradeName: true, logoUrl: true } }, item: { select: { id: true, name: true } }, pets: { select: { pet: { select: { id: true, name: true, avatarUrl: true } } } }, address: true },
          orderBy: { startsAt: "asc" },
          take: 20,
        })
      : [],
    petIds.length
      ? prisma.earnedBadge.findMany({ where: { petId: { in: petIds } }, include: { badge: true, pet: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { earnedAt: "desc" }, take: 5 })
      : [],
    prisma.installment.findMany({
      where: { status: "OVERDUE", contract: { client: { userId: user.id }, status: { in: ["ACTIVE", "COMPLETED"] } } },
      include: { contract: { select: { id: true, title: true, partner: { select: { id: true, tradeName: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);
  return ok(
    serialize({
      today,
      tasksToday,
      upcomingAppointments: upcomingAppointments.map((a) => ({ ...a, pets: a.pets.map((p) => p.pet) })),
      recentBadges,
      pets,
      overdueInstallments,
    }),
  );
});
