import { handler, ok, requireUser, rateLimit } from "@/server";
import { breedInfo } from "@/server/breed-info";

/**
 * GET /ref/breeds/:id/info → breed facts (dogs/cats) or null. Served from the database cache; API Ninjas is called
 * only when this breed was never looked up (see src/server/breed-info.ts).
 */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  await rateLimit(`breed-info:${user.id}`, 60, 60_000);
  return ok(await breedInfo(params.id));
});
