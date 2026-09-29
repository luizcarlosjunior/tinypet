import { z } from "zod";
import { InstallmentStatusEnum } from "@tinypet/shared";
import { handler, ok, parseQuery, requireUser, serialize } from "@/server";
import { listOwnerInstallments } from "@/server/finance";

const query = z.object({ status: InstallmentStatusEnum.optional() });

/** GET /me/installments?status */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const q = parseQuery(req, query);
  return ok(serialize(await listOwnerInstallments(user.id, q.status)));
});
