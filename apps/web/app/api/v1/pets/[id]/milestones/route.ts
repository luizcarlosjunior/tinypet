import { handler, ok } from "@/server";
import { petActor, milestones } from "@/server/pets";

/** Shareable timeline: titled gallery moments, badges and birthdays. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  return ok(await milestones(params.id));
});
