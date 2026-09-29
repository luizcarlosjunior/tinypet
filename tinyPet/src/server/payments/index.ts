import { prisma } from "@/db";
import type { PaymentProvider } from "./provider";
import { pagarme } from "./pagarme";

export * from "./provider";

export function getPaymentProvider(): PaymentProvider {
  return pagarme;
}

export class WebhookAuthError extends Error {}

/**
 * Authenticates, stores the event idempotently and applies it. Returns false when already processed.
 * Throws WebhookAuthError on bad credentials.
 */
export async function ingestWebhook(provider: PaymentProvider, rawBody: string, headers: Headers) {
  if (!provider.verifyWebhook(headers, rawBody)) throw new WebhookAuthError("Webhook não autenticado");
  const evt = provider.parseWebhook(rawBody);
  const key = `${provider.name}:${evt.id}`;
  const exists = await prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
  if (exists?.processedAt) return false;
  const row = exists ?? (await prisma.webhookEvent.create({ data: { provider: provider.name, idempotencyKey: key, type: evt.type, payload: evt.payload as object } }));
  try {
    await applyWebhook(provider, evt.type, evt.payload);
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { processedAt: new Date(), error: null } });
  } catch (e) {
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { error: e instanceof Error ? e.message : String(e) } });
    throw e;
  }
  return true;
}

async function applyWebhook(provider: PaymentProvider, type: string, payload: unknown) {
  const data = (payload as { data?: { id?: string; code?: string; status?: string } }).data ?? {};
  if (type.startsWith("order.")) {
    if (!data.id) return;
    const order = await prisma.gatewayOrder.findFirst({ where: { gatewayOrderId: data.id } });
    if (!order) return;
    if (type === "order.paid") {
      // Never trust the webhook body for money: re-fetch the order and check status + amount.
      let remote: Awaited<ReturnType<PaymentProvider["getOrder"]>>;
      try {
        remote = await provider.getOrder(data.id);
      } catch (e) {
        throw new Error(`Falha ao confirmar pedido no gateway: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (remote.status !== "paid") throw new Error(`Pedido ${data.id} não está pago no gateway (status=${remote.status})`);
      if (remote.amount !== order.amountCents) throw new Error(`Valor divergente para ${data.id}: gateway=${remote.amount} esperado=${order.amountCents}`);
    }
    const status = type === "order.paid" ? "paid" : type === "order.payment_failed" ? "failed" : type === "order.canceled" ? "canceled" : (data.status ?? order.status);
    if (order.status === "paid" && status !== "paid") {
      // A paid order can't be downgraded by a later/out-of-order event.
      await prisma.gatewayOrder.update({ where: { id: order.id }, data: { payload: payload as object } });
      return;
    }
    await prisma.gatewayOrder.update({ where: { id: order.id }, data: { status, payload: payload as object } });
    if (type === "order.paid" && order.kind === "installment") {
      const inst = await prisma.installment.findUnique({ where: { id: order.referenceId } });
      const already = await prisma.payment.findFirst({ where: { gatewayOrderId: order.id } });
      if (inst && inst.status !== "PAID" && !already) {
        const amount = order.amountCents / 100;
        await prisma.$transaction([
          prisma.payment.create({ data: { installmentId: inst.id, paidAt: new Date(), amount, method: "GATEWAY", gatewayOrderId: order.id } }),
          prisma.installment.update({ where: { id: inst.id }, data: { paidAmount: { increment: amount }, status: Number(inst.paidAmount) + amount >= Number(inst.amount) ? "PAID" : inst.status } }),
        ]);
      }
    }
  } else if (type.startsWith("subscription.")) {
    if (!data.id) return; // `undefined` in a Prisma where would match ANY subscription
    const sub = await prisma.subscription.findFirst({ where: { gatewaySubscriptionId: data.id } });
    if (!sub) return;
    const status = type === "subscription.canceled" ? "CANCELED" : type.includes("past_due") || type.includes("payment_failed") ? "PAST_DUE" : "ACTIVE";
    await prisma.subscription.update({ where: { id: sub.id }, data: { status } });
  }
}
