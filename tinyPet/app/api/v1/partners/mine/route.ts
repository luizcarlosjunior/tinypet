import { prisma } from "@/db";
import { handler, ok, requireUser, serialize } from "@/server";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, partner: { deletedAt: null } },
    include: { partner: { include: { types: { include: { type: { select: { key: true, label: true } } } } } } },
    orderBy: { createdAt: "asc" },
  });
  return ok(
    serialize(
      memberships.map((m) => ({
        membershipId: m.id,
        role: m.role,
        canSeeFinance: m.role === "OWNER" || m.canSeeFinance,
        ...m.partner,
        types: m.partner.types.map((t) => t.type),
      })),
    ),
  );
});
