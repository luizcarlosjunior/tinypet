import { z } from "zod";
import { handler, ok, parseQuery } from "@/server";
import { brandsReport, reportMode } from "@/server/reports";

const query = z.object({ species: z.string().optional(), state: z.string().optional(), city: z.string().optional() });

/** Aggregated food-brand demand by city. Partner: own clients' pets; admin: whole platform. No tutor identification. */
export const GET = handler(async (req) => {
  const mode = await reportMode(req);
  return ok(await brandsReport(mode, parseQuery(req, query)));
});
