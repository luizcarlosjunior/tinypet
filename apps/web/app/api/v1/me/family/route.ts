import { prisma } from "@tinypet/db";
import { familyMemberSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser } from "@/server";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(await prisma.familyMember.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }));
});

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, familyMemberSchema);
  const linked = body.email ? await prisma.user.findFirst({ where: { email: body.email, deletedAt: null }, select: { id: true } }) : null;
  return ok(await prisma.familyMember.create({ data: { ...body, userId: user.id, linkedUserId: linked?.id ?? null } }), { status: 201 });
});
