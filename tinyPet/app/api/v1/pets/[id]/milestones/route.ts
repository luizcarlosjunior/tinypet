import { handler, ok } from "@/server";
import { petActor, milestones, visibleMediaFor } from "@/server/pets";

/** Shareable timeline: titled gallery moments, badges and birthdays. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "VIEW");
  return ok(await milestones(params.id, visibleMediaFor(actor.via)));
});
