import { handler, ok, serialize } from "@/server";
import { petActor, foodSuggestions } from "@/server/pets";

/** Published partners whose catalog has the pet's brands, sorted by distance from the owner's primary address; active promos as `offers`. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  return ok(serialize(await foodSuggestions(params.id)));
});
