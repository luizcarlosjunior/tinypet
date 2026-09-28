import { phoneSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser } from "@/server";
import { phones } from "@/server/crm";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(await phones.list({ userId: user.id }));
});

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, phoneSchema);
  return ok(await phones.create({ userId: user.id }, body), { status: 201 });
});
