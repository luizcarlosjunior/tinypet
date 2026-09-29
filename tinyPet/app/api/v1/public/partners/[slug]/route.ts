import { handler, ok, serialize } from "@/server";
import { getPublicPartner } from "@/server/public";

export const GET = handler<{ slug: string }>(async (_req, { params }) => {
  return ok(serialize(await getPublicPartner(params.slug)));
});
