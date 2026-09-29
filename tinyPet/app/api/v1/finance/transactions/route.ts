import { z } from "zod";
import { prisma } from "@/db";
import { transactionSchema, TransactionKindEnum, dateString } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, requirePartner, serialize, audit, clientIp } from "@/server";
import { dateOnly, listTransactions, optionalPage } from "@/server/finance";

const query = z.object({ from: dateString.optional(), to: dateString.optional(), kind: TransactionKindEnum.optional() });

/** GET /finance/transactions?from&to&kind */
export const GET = handler(async (req) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const q = parseQuery(req, query);
  const { data, meta } = optionalPage(await listTransactions(ctx.partnerId, q), req.nextUrl.searchParams);
  return ok(serialize(data), meta ? { meta } : undefined);
});

/** POST /finance/transactions (transactionSchema) */
export const POST = handler(async (req) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const body = await parseBody(req, transactionSchema);
  const row = await prisma.transaction.create({ data: { partnerId: ctx.partnerId, kind: body.kind, category: body.category, description: body.description ?? null, amount: body.amount, occurredAt: dateOnly(body.occurredAt), method: body.method ?? null } });
  await audit({ userId: ctx.user.id, partnerId: ctx.partnerId, action: "transaction.create", entity: "Transaction", entityId: row.id, data: { kind: body.kind, amount: body.amount }, ip: clientIp(req) });
  return ok(serialize(row), { status: 201 });
});
