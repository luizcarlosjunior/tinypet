import { z } from "zod";
import type { NextRequest } from "next/server";
import { prisma } from "@tinypet/db";
import { Errors } from "../errors";
import { clientIp, rateLimit } from "../api";
import { getUser } from "../auth";
import { blogAppUrl } from "./auth";
import { publishedWhere } from "./posts";
import { spDayKey } from "./utils";
import { isBotUserAgent, isSameOriginRequest, parseUa, referrerHost, viewSalt, viewSource, visitorHash } from "./visitor";

export const viewBodySchema = z.object({
  screenWidth: z.coerce.number().int().min(0).max(20000).optional().nullable(),
  screenHeight: z.coerce.number().int().min(0).max(20000).optional().nullable(),
  /** `document.referrer` of the post page (the beacon's own Referer is the post itself). */
  referrer: z.string().max(2000).optional().nullable(),
});

/**
 * Records a raw view log (processed later by /jobs/blog-views). Returns `false` when the view is ignored
 * (preview, bot). Browsers must be same-origin; the native app (no Origin) must send a valid mobile JWT
 * (device recorded as "app"). Throws 403 otherwise, 404 for unknown posts, 429 over 60/min per visitor.
 */
export async function recordView(req: NextRequest, postId: string, body: z.infer<typeof viewBodySchema>): Promise<boolean> {
  if (req.nextUrl.searchParams.get("preview") === "1") return false;
  const appUrl = blogAppUrl();
  const sameOrigin = isSameOriginRequest(req.headers, appUrl);
  const origin = req.headers.get("origin");
  const hasOrigin = !!origin && origin !== "null";
  // Native app (no Origin/Referer): accepted only with a valid mobile JWT (signature, expiry, tokenVersion checked).
  const bearer = !sameOrigin && !hasOrigin && (req.headers.get("authorization") ?? "").startsWith("Bearer ");
  const validBearer = bearer ? !!(await getUser(req)) : false;
  const source = viewSource({ sameOrigin, hasOrigin, validBearer });
  if (source === "reject") throw Errors.forbidden("Origem não permitida");
  const ua = req.headers.get("user-agent") ?? "";
  if (isBotUserAgent(ua)) return false;
  const hash = visitorHash(clientIp(req), ua, spDayKey(new Date()), viewSalt());
  await rateLimit(`blog:view:${hash}`, 60, 60_000);
  const post = await prisma.blogPost.findFirst({ where: { ...publishedWhere(), id: postId }, select: { id: true } });
  if (!post) throw Errors.notFound("Post não encontrado");
  const parsed = parseUa(ua);
  const { browser, os } = parsed;
  const device = source === "app" ? "app" : parsed.device;
  await prisma.blogPostViewLog.create({
    data: {
      postId,
      visitorHash: hash,
      referrerHost: referrerHost(body.referrer, appUrl),
      device,
      browser,
      os,
      screenWidth: body.screenWidth ?? null,
      screenHeight: body.screenHeight ?? null,
    },
  });
  return true;
}
