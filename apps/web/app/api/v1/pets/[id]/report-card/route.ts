import { handler, ok } from "@/server";
import { petActor, reportCard } from "@/server/pets";

/** Birthday card data: age, next birthday, name, avatar. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  return ok(await reportCard(params.id));
});
