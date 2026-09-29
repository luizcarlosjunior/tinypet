import { handler, ok } from "@/server";
import { petActor } from "@/server/pets";
import { petBadges } from "@/server/badges";

/** All system badges with earned status (+ partner badges earned). */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  return ok(await petBadges(params.id));
});
