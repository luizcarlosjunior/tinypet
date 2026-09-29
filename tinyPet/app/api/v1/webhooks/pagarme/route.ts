import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider, ingestWebhook, WebhookAuthError } from "@/server/payments";

const MAX_BODY_BYTES = 256 * 1024;

/** Pagar.me webhook. Auth: HTTP Basic (PAGARME_WEBHOOK_USER/PASSWORD). Fails closed (401) when not configured. */
export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider.verifyWebhook(req.headers, "")) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Não autorizado" } }, { status: 401, headers: { "WWW-Authenticate": 'Basic realm="webhooks"' } });
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Payload muito grande" } }, { status: 413 });
  const raw = await readLimited(req, MAX_BODY_BYTES);
  if (raw === null) return NextResponse.json({ ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Payload muito grande" } }, { status: 413 });
  try {
    const applied = await ingestWebhook(provider, raw, req.headers);
    return NextResponse.json({ ok: true, applied });
  } catch (e) {
    if (e instanceof WebhookAuthError) return NextResponse.json({ ok: false }, { status: 401 });
    console.error("[webhook] pagarme", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

/** Reads the body as text, aborting once it exceeds `max` bytes (content-length can be absent or lie). */
async function readLimited(req: NextRequest, max: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
