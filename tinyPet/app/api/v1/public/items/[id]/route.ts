import { handler, ok, serialize } from "@/server";
import { getPublicItem } from "@/server/public";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  return ok(serialize(await getPublicItem(params.id)));
});
