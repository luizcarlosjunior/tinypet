import { cronRoute, jobWeightAlerts } from "@/server/jobs";

export const { GET, POST } = cronRoute(() => jobWeightAlerts());

/** Never statically cached: must run on every cron hit. */
export const dynamic = "force-dynamic";
