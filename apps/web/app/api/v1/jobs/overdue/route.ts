import { cronRoute, jobOverdue } from "@/server/jobs";

export const { GET, POST } = cronRoute(() => jobOverdue());

/** Never statically cached: must run on every cron hit. */
export const dynamic = "force-dynamic";
