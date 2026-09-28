import { z } from "zod";
import { verifyCodeSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, rateLimit } from "@/server";
import { sendPartnerVerification, confirmPartnerVerification } from "@/server/partners";

/** POST { channel } sends a code to the partner's primary e-mail/phone. PUT { channel, code } confirms. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  rateLimit(`partner-verify:${ctx.partnerId}`, 5, 15 * 60 * 1000);
  const { channel } = await parseBody(req, z.object({ channel: z.enum(["EMAIL", "PHONE"]) }));
  return ok(await sendPartnerVerification(ctx.user.id, ctx.partnerId, channel));
});

export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req, params.id);
  const { channel, code } = await parseBody(req, verifyCodeSchema);
  return ok(await confirmPartnerVerification(ctx.user.id, ctx.partnerId, channel, code));
});
