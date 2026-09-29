import { z } from "zod";
import { contractSchema, ContractStatusEnum, id } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, requirePartner, serialize, clientIp } from "@/server";
import { createContract, listContracts, optionalPage } from "@/server/finance";

const query = z.object({ status: ContractStatusEnum.optional(), clientId: id.optional() });

/** GET /finance/contracts?status&clientId */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const q = parseQuery(req, query);
  const { data, meta } = optionalPage(await listContracts(ctx.partnerId, q), req.nextUrl.searchParams);
  return ok(serialize(data), meta ? { meta } : undefined);
});

/** POST /finance/contracts (contractSchema) → DRAFT contract with installments (total − discount split evenly, last absorbs rounding). */
export const POST = handler(async (req) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const body = await parseBody(req, contractSchema);
  const row = await createContract({ partnerId: ctx.partnerId, userId: ctx.user.id, membershipId: ctx.membershipId, ip: clientIp(req) }, body);
  return ok(serialize(row), { status: 201 });
});
