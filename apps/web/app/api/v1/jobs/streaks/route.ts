import { cronRoute, jobStreaks } from "@/server/jobs";

export const { GET, POST } = cronRoute(() => jobStreaks());

/** Never statically cached: must run on every cron hit. */
export const dynamic = "force-dynamic";
