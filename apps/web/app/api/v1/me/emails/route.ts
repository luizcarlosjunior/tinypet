import { emailSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser } from "@/server";
import { emails } from "@/server/crm";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(await emails.list({ userId: user.id }));
});

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, emailSchema);
  return ok(await emails.create({ userId: user.id }, body), { status: 201 });
});
