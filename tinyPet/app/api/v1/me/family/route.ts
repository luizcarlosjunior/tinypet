import { prisma } from "@/db";
import { familyMemberSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser } from "@/server";
import { familyView } from "@/server/pets";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(await familyView(user.id, await prisma.familyMember.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } })));
});

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, familyMemberSchema);
  const linked = body.email ? await prisma.user.findFirst({ where: { email: body.email.toLowerCase(), deletedAt: null }, select: { id: true } }) : null;
  const row = await prisma.familyMember.create({ data: { ...body, userId: user.id, linkedUserId: linked?.id ?? null } });
  return ok((await familyView(user.id, [row]))[0], { status: 201 });
});
