import { cronRoute } from "@/server/jobs";
import { recomputeSkillStats } from "@/server/skills";

export const { GET, POST } = cronRoute(() => recomputeSkillStats());

/** Never statically cached: must run on every cron hit. */
export const dynamic = "force-dynamic";
