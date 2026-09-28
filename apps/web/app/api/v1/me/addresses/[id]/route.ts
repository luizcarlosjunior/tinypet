import { addressSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { addresses } from "@/server/crm";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const body = await parseBody(req, addressSchema.partial());
  return ok(serialize(await addresses.update({ userId: user.id }, params.id, body)));
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  await addresses.remove({ userId: user.id }, params.id);
  return ok({ deleted: true });
});
