import { createHash, timingSafeEqual } from "node:crypto";
import type { PaymentProvider, CreateOrderInput, CreateOrderResult, CreateRecipientInput, SubscriptionInput, WebhookEventInput } from "./provider";

const BASE = "https://api.pagar.me/core/v5";

function authHeader() {
  const key = process.env.PAGARME_SECRET_KEY ?? "";
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

async function call<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  if (!process.env.PAGARME_SECRET_KEY) throw new Error("Pagar.me não configurado (PAGARME_SECRET_KEY)");
  const res = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: authHeader() }, body: body ? JSON.stringify(body) : undefined });
  const json = (await res.json()) as T & { message?: string };
  if (!res.ok) throw new Error(json.message ?? `Pagar.me ${res.status}`);
  return json;
}

/**
 * Pagar.me v5 adapter. Amounts in cents. Card data never touches our servers (tokenized client-side).
 * Docs: https://docs.pagar.me/docs/llms
 */
export const pagarme: PaymentProvider = {
  name: "pagarme",

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const payments = input.methods.map((m) => {
      if (m === "pix") return { payment_method: "pix", pix: { expires_in: 3600 }, amount: input.amount };
      if (m === "boleto") return { payment_method: "boleto", boleto: { due_at: new Date(Date.now() + 3 * 86400000).toISOString() }, amount: input.amount };
      return { payment_method: "credit_card", credit_card: { installments: input.installments ?? 1, card_token: input.cardToken }, amount: input.amount };
    });
    const order = await call<{ id: string; status: string; charges?: { last_transaction?: { qr_code?: string; qr_code_url?: string; expires_at?: string; url?: string; line?: string; due_at?: string } }[] }>("/orders", {
      code: `${input.kind}:${input.referenceId}`,
      items: [{ amount: input.amount, description: input.description, quantity: 1, code: input.referenceId }],
      customer: { name: input.customer.name, email: input.customer.email, code: input.customer.id, document: input.customer.document, type: "individual" },
      payments: payments.map((p) => ({ ...p, split: input.split?.map((s) => ({ recipient_id: s.recipientId, amount: s.amount, type: "flat", options: { charge_processing_fee: s.chargeProcessingFee, liable: true } })) })),
    });
    const tx = order.charges?.[0]?.last_transaction;
    return {
      gatewayOrderId: order.id,
      status: order.status === "paid" ? "paid" : order.status === "failed" ? "failed" : "pending",
      pix: tx?.qr_code ? { qrCode: tx.qr_code, qrCodeUrl: tx.qr_code_url ?? "", expiresAt: tx.expires_at ?? "" } : undefined,
      boleto: tx?.line ? { url: tx.url ?? "", line: tx.line, dueAt: tx.due_at ?? "" } : undefined,
    };
  },

  async createRecipient(input: CreateRecipientInput) {
    const r = await call<{ id: string; status: string }>("/recipients", {
      name: input.name,
      email: input.email,
      document: input.document,
      type: input.document.length > 11 ? "company" : "individual",
      default_bank_account: { holder_name: input.name, holder_type: input.document.length > 11 ? "company" : "individual", holder_document: input.document, bank: input.bank.code, branch_number: input.bank.branch, account_number: input.bank.account, account_check_digit: input.bank.accountDigit, type: input.bank.type },
      transfer_settings: { transfer_enabled: true, transfer_interval: "Daily", transfer_day: 0 },
    });
    return { gatewayRecipientId: r.id, status: r.status };
  },

  async createSubscription(input: SubscriptionInput) {
    const r = await call<{ id: string; status: string }>("/subscriptions", { customer_id: input.customerId, plan_id: input.planKey, payment_method: input.method, card_token: input.cardToken, interval: input.interval });
    return { gatewaySubscriptionId: r.id, status: r.status };
  },

  async cancelSubscription(id: string) {
    await call(`/subscriptions/${id}`, undefined, "DELETE");
  },

  /**
   * Pagar.me webhooks authenticate with HTTP Basic credentials configured in the dashboard
   * (PAGARME_WEBHOOK_USER / PAGARME_WEBHOOK_PASSWORD). Fails closed when not configured.
   */
  verifyWebhook(headers: Headers) {
    const user = process.env.PAGARME_WEBHOOK_USER ?? "";
    const pass = process.env.PAGARME_WEBHOOK_PASSWORD ?? "";
    if (!user || !pass) return false;
    const h = headers.get("authorization") ?? "";
    if (!h.startsWith("Basic ")) return false;
    let decoded = "";
    try {
      decoded = Buffer.from(h.slice(6).trim(), "base64").toString("utf8");
    } catch {
      return false;
    }
    const i = decoded.indexOf(":");
    if (i < 0) return false;
    const okUser = safeEqual(decoded.slice(0, i), user);
    const okPass = safeEqual(decoded.slice(i + 1), pass);
    return okUser && okPass;
  },

  async getOrder(gatewayOrderId: string) {
    const o = await call<{ id: string; status: string; amount: number }>(`/orders/${encodeURIComponent(gatewayOrderId)}`, undefined, "GET");
    return { id: o.id, status: o.status, amount: o.amount };
  },

  parseWebhook(rawBody: string): WebhookEventInput {
    const j = JSON.parse(rawBody) as { id?: unknown; type?: unknown; data?: unknown };
    if (typeof j?.id !== "string" || typeof j.type !== "string") throw new Error("Webhook malformado");
    return { id: j.id, type: j.type, payload: j };
  },
};
