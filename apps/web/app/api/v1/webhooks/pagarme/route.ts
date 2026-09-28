import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider, ingestWebhook } from "@/server/payments";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  try {
    const applied = await ingestWebhook(getPaymentProvider(), raw, req.headers.get("x-hub-signature"));
    return NextResponse.json({ ok: true, applied });
  } catch (e) {
    console.error("[webhook] pagarme", e);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
