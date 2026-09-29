import { z } from "zod";
import { verifyCodeSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, rateLimit } from "@/server";
import { sendPartnerVerification, confirmPartnerVerification } from "@/server/partners";

/** POST { channel } sends a code to the partner's primary e-mail/phone (5/15min per user). PUT { channel, code } confirms (10/15min per user). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  await rateLimit(`partner-verify:send:${ctx.user.id}`, 5, 15 * 60 * 1000);
  await rateLimit(`partner-verify:send:partner:${ctx.partnerId}`, 5, 15 * 60 * 1000);
  const { channel } = await parseBody(req, z.object({ channel: z.enum(["EMAIL", "PHONE"]) }));
  return ok(await sendPartnerVerification(ctx.user.id, ctx.partnerId, channel));
});

export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  await rateLimit(`partner-verify:confirm:${ctx.user.id}`, 10, 15 * 60 * 1000);
  const { channel, code } = await parseBody(req, verifyCodeSchema);
  return ok(await confirmPartnerVerification(ctx.user.id, ctx.partnerId, channel, code));
});
