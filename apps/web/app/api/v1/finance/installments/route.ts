import { z } from "zod";
import { InstallmentStatusEnum, dateString, id } from "@tinypet/shared";
import { handler, ok, parseQuery, requirePartner, serialize } from "@/server";
import { listInstallments, optionalPage } from "@/server/finance";

const query = z.object({ status: InstallmentStatusEnum.optional(), from: dateString.optional(), to: dateString.optional(), clientId: id.optional() });

/** GET /finance/installments?status&from&to&clientId */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const q = parseQuery(req, query);
  const { data, meta } = optionalPage(await listInstallments(ctx.partnerId, q), req.nextUrl.searchParams);
  return ok(serialize(data), meta ? { meta } : undefined);
});
