import { prisma } from "@tinypet/db";
import { petAccessSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors, notify } from "@/server";
import { petActor } from "@/server/pets";

/** Owner and family only (partners never see family members' e-mails). */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "VIEW");
  if (actor.via === "partner") throw Errors.forbidden("Apenas o tutor e a família podem ver os acessos");
  return ok(await prisma.petAccess.findMany({ where: { petId: params.id }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } }));
});

/** Share by e-mail (user must already have an account). Owner only. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via !== "owner") throw Errors.forbidden("Apenas o tutor principal pode compartilhar o pet");
  const body = await parseBody(req, petAccessSchema);
  const target = await prisma.user.findFirst({ where: { email: body.email, deletedAt: null }, select: { id: true, name: true } });
  if (!target) throw Errors.notFound("Nenhuma conta tinyPet com este e-mail");
  if (target.id === actor.user.id) throw Errors.badRequest("Você já é o tutor principal");
  const access = await prisma.petAccess.upsert({
    where: { petId_userId: { petId: params.id, userId: target.id } },
    update: { level: body.level },
    create: { petId: params.id, userId: target.id, level: body.level },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });
  await notify({ userId: target.id, type: "pet_shared", title: `${actor.user.name} compartilhou ${actor.pet.name} com você`, body: body.level === "EDIT" ? "Você pode ver e editar a ficha." : "Você pode ver a ficha.", data: { petId: params.id } });
  return ok(access, { status: 201 });
});
