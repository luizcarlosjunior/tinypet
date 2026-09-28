/**
 * Payment gateway abstraction (phase 3). Modules never talk to Pagar.me directly:
 * they call the provider, and webhooks update Payment / Installment / Subscription.
 */
export type Cents = number;

export type CreateOrderInput = {
  kind: "installment" | "course" | "addon" | "subscription";
  referenceId: string;
  amount: Cents;
  description: string;
  customer: { id: string; name: string; email: string; document?: string; phone?: string };
  methods: ("pix" | "boleto" | "credit_card")[];
  cardToken?: string;
  installments?: number;
  split?: { recipientId: string; amount: Cents; chargeProcessingFee: boolean }[];
};

export type CreateOrderResult = {
  gatewayOrderId: string;
  status: "pending" | "paid" | "failed";
  pix?: { qrCode: string; qrCodeUrl: string; expiresAt: string };
  boleto?: { url: string; line: string; dueAt: string };
};

export type CreateRecipientInput = {
  partnerId: string;
  name: string;
  document: string;
  email: string;
  bank: { code: string; branch: string; account: string; accountDigit: string; type: "checking" | "savings" };
};

export type SubscriptionInput = { customerId: string; planKey: string; interval: "month" | "year"; cardToken?: string; method: "credit_card" | "boleto" };

export type WebhookEventInput = { id: string; type: string; payload: unknown };

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  createRecipient(input: CreateRecipientInput): Promise<{ gatewayRecipientId: string; status: string }>;
  createSubscription(input: SubscriptionInput): Promise<{ gatewaySubscriptionId: string; status: string }>;
  cancelSubscription(gatewaySubscriptionId: string): Promise<void>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
  parseWebhook(rawBody: string): WebhookEventInput;
}
