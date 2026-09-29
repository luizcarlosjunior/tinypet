import { prisma } from "@/db";
import { slotsQuery } from "@tinypet/shared";
import { handler, ok, parseQuery, Errors } from "@/server";
import { computeSlots } from "@/server/scheduling";

/** Public free slots for a bookable item: delegates to the scheduling module. */
export const GET = handler<{ slug: string }>(async (req, { params }) => {
  const q = parseQuery(req, slotsQuery);
  const partner = await prisma.partner.findFirst({ where: { slug: params.slug, published: true, deletedAt: null }, select: { id: true } });
  if (!partner) throw Errors.notFound("Parceiro não encontrado");
  const item = await prisma.catalogItem.findFirst({ where: { id: q.itemId, partnerId: partner.id, deletedAt: null, status: "PUBLISHED", bookable: true }, select: { id: true } });
  if (!item) throw Errors.notFound("Serviço não disponível para agendamento");
  return ok(await computeSlots({ partnerId: partner.id, itemId: q.itemId, date: q.date, membershipId: q.membershipId }));
});
