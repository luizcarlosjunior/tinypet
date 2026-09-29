import { phoneSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser } from "@/server";
import { phones } from "@/server/crm";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const body = await parseBody(req, phoneSchema.partial());
  return ok(await phones.update({ userId: user.id }, params.id, body));
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  await phones.remove({ userId: user.id }, params.id);
  return ok({ deleted: true });
});
