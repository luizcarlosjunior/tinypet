import { handler, requirePartner } from "@/server";
import { contractHtml } from "@/server/finance";

/** GET /finance/contracts/:id/pdf → printable HTML (terms, items, installments, acceptance). */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, undefined, { finance: true });
  const html = await contractHtml(params.id, { partnerId: ctx.partnerId });
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
});
