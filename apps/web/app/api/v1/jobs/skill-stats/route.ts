import { handler, ok } from "@/server";
import { requireCron } from "@/server/jobs";
import { recomputeSkillStats } from "@/server/skills";

export const POST = handler(async (req) => {
  requireCron(req);
  return ok(await recomputeSkillStats());
});
