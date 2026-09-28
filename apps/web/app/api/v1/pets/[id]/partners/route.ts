import { prisma } from "@tinypet/db";
import { handler, ok, Errors } from "@/server";
import { petActor } from "@/server/pets";

/** GET /pets/:id/partners (owner only) → partners linked to the pet via ClientPet, with the date of the first link. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "VIEW");
  if (actor.via !== "owner") throw Errors.forbidden("Apenas o tutor principal pode gerenciar os parceiros do pet");
  const links = await prisma.clientPet.findMany({
    where: { petId: params.id, client: { deletedAt: null, partner: { deletedAt: null } } },
    select: { client: { select: { createdAt: true, partner: { select: { id: true, slug: true, tradeName: true, logoUrl: true } } } } },
  });
  const byPartner = new Map<string, { partner: (typeof links)[number]["client"]["partner"]; since: Date }>();
  for (const l of links) {
    const cur = byPartner.get(l.client.partner.id);
    if (!cur || l.client.createdAt < cur.since) byPartner.set(l.client.partner.id, { partner: l.client.partner, since: l.client.createdAt });
  }
  return ok(Array.from(byPartner.values()).map((v) => ({ ...v.partner, name: v.partner.tradeName, since: v.since })));
});
