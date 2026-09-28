import { cronRoute, jobStoriesCleanup } from "@/server/jobs";

export const { GET, POST } = cronRoute(() => jobStoriesCleanup());

/** Never statically cached: must run on every cron hit. */
export const dynamic = "force-dynamic";
