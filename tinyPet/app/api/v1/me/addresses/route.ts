import { addressSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { addresses } from "@/server/crm";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(serialize(await addresses.list({ userId: user.id })));
});

/** Geocodes when latitude/longitude are missing. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, addressSchema);
  return ok(serialize(await addresses.create({ userId: user.id }, body)), { status: 201 });
});
