import { z } from "zod";
import { handler, ok, parseQuery, rateLimit, clientIp, getUser } from "@/server";
import { usernameAvailability } from "@/server/sharing";

const query = z.object({ u: z.string().max(64).default("") });

/** Live check for the @username field (registration and account page). Public, rate limited per IP. */
export const GET = handler(async (req) => {
  await rateLimit(`username-available:ip:${clientIp(req)}`, 60, 60 * 1000);
  const { u } = parseQuery(req, query);
  const me = await getUser(req).catch(() => null);
  return ok(await usernameAvailability(u, me?.id));
});
