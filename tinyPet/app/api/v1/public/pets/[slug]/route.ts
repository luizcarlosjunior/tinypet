import { handler, ok } from "@/server";
import { publicPetProfile } from "@/server/public-pet";

/** GET /public/pets/:slug — public pet profile (404 unless the owner enabled it). */
export const GET = handler<{ slug: string }>(async (_req, { params }) => ok(await publicPetProfile(params.slug)));
