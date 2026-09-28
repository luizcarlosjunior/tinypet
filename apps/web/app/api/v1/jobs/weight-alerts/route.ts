import { handler, ok } from "@/server";
import { requireCron } from "@/server/jobs";
import { jobWeightAlerts } from "@/server/jobs";

export const POST = handler(async (req) => {
  requireCron(req);
  return ok(await jobWeightAlerts());
});
