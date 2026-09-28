import { prisma } from "@tinypet/db";
import type { PaymentProvider } from "./provider";
import { pagarme } from "./pagarme";

export * from "./provider";

export function getPaymentProvider(): PaymentProvider {
  return pagarme;
}

/** Stores the event idempotently and applies it. Returns false when already processed. */
export async function ingestWebhook(provider: PaymentProvider, rawBody: string, signature: string | null) {
  if (!provider.verifyWebhook(rawBody, signature)) throw new Error("Assinatura inválida");
  const evt = provider.parseWebhook(rawBody);
  const key = `${provider.name}:${evt.id}`;
  const exists = await prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
  if (exists?.processedAt) return false;
  const row = exists ?? (await prisma.webhookEvent.create({ data: { provider: provider.name, idempotencyKey: key, type: evt.type, payload: evt.payload as object } }));
  try {
    await applyWebhook(evt.type, evt.payload);
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { processedAt: new Date(), error: null } });
  } catch (e) {
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { error: e instanceof Error ? e.message : String(e) } });
    throw e;
  }
  return true;
}

async function applyWebhook(type: string, payload: unknown) {
  const data = (payload as { data?: { id?: string; code?: string; status?: string } }).data ?? {};
  if (type.startsWith("order.")) {
    const order = await prisma.gatewayOrder.findFirst({ where: { gatewayOrderId: data.id } });
    if (!order) return;
    const status = type === "order.paid" ? "paid" : type === "order.payment_failed" ? "failed" : type === "order.canceled" ? "canceled" : (data.status ?? order.status);
    await prisma.gatewayOrder.update({ where: { id: order.id }, data: { status, payload: payload as object } });
    if (type === "order.paid" && order.kind === "installment") {
      const inst = await prisma.installment.findUnique({ where: { id: order.referenceId } });
      if (inst && inst.status !== "PAID") {
        const amount = order.amountCents / 100;
        await prisma.$transaction([
          prisma.payment.create({ data: { installmentId: inst.id, paidAt: new Date(), amount, method: "GATEWAY", gatewayOrderId: order.id } }),
          prisma.installment.update({ where: { id: inst.id }, data: { paidAmount: { increment: amount }, status: Number(inst.paidAmount) + amount >= Number(inst.amount) ? "PAID" : inst.status } }),
        ]);
      }
    }
  } else if (type.startsWith("subscription.")) {
    const sub = await prisma.subscription.findFirst({ where: { gatewaySubscriptionId: data.id } });
    if (!sub) return;
    const status = type === "subscription.canceled" ? "CANCELED" : type.includes("past_due") || type.includes("payment_failed") ? "PAST_DUE" : "ACTIVE";
    await prisma.subscription.update({ where: { id: sub.id }, data: { status } });
  }
}
