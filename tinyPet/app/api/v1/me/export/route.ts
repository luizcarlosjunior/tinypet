import { prisma } from "@/db";
import { handler, ok, requireUser, serialize } from "@/server";

/** LGPD: full JSON dump of the user's data. */
export const GET = handler(async (req) => {
  const { id } = await requireUser(req);
  const [user, pets, clients, reviews, enrollments, appointments, notifications, taskCompletions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, name: true, email: true, avatarUrl: true, birthDate: true, role: true, locale: true, timezone: true, marketingConsent: true, publicPhotosConsent: true, statsConsent: true,
        termsVersion: true, termsAcceptedAt: true, emailVerifiedAt: true, createdAt: true,
        ownerTerm: { select: { label: true } }, phones: true, emails: true, addresses: true, familyMembers: true,
        subscription: { include: { plan: { select: { key: true, name: true } }, addOns: true } },
        petAccesses: { include: { pet: { select: { id: true, name: true } } } },
        memberships: { select: { partnerId: true, role: true, jobTitle: true, createdAt: true, partner: { select: { tradeName: true } } } },
      },
    }),
    prisma.pet.findMany({
      where: { ownerId: id },
      include: {
        species: { select: { key: true, label: true } }, breed: { select: { name: true } },
        media: { where: { deletedAt: null } }, historyEvents: true, foods: { include: { brand: { select: { name: true } }, productLine: { select: { name: true } } } },
        measurements: true, skills: { include: { skill: { select: { name: true } } } }, vaccinations: true, tasks: { include: { completions: true } },
        earnedBadges: { include: { badge: { select: { key: true, name: true } } } }, accesses: { include: { user: { select: { name: true, email: true } } } },
      },
    }),
    prisma.client.findMany({ where: { userId: id }, include: { partner: { select: { tradeName: true } }, contracts: { include: { installments: { include: { payments: true } }, items: true } } } }),
    prisma.review.findMany({ where: { userId: id }, include: { reply: true } }),
    prisma.enrollment.findMany({ where: { userId: id }, include: { course: { select: { title: true } }, progress: true, certificate: true } }),
    prisma.appointment.findMany({ where: { OR: [{ requestedByUserId: id }, { client: { userId: id } }] }, include: { partner: { select: { tradeName: true } }, item: { select: { name: true } }, pets: { select: { pet: { select: { name: true } } } } } }),
    prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } }),
    prisma.taskCompletion.findMany({ where: { userId: id } }),
  ]);
  return ok(serialize({ exportedAt: new Date(), user, pets, clients, reviews, enrollments, appointments, notifications, taskCompletions }));
});
