import { handler, ok } from "@/server";
import { requireCron } from "@/server/jobs";
import { jobStreaks } from "@/server/jobs";

export const POST = handler(async (req) => {
  requireCron(req);
  return ok(await jobStreaks());
});
