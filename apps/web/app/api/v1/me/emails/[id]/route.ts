import { emailSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser } from "@/server";
import { emails } from "@/server/crm";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const body = await parseBody(req, emailSchema.partial());
  return ok(await emails.update({ userId: user.id }, params.id, body));
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  await emails.remove({ userId: user.id }, params.id);
  return ok({ deleted: true });
});
