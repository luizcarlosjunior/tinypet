import { cronRoute } from "@/server/jobs";
import { jobBlogViews } from "@/server/blog/jobs";

export const { GET, POST } = cronRoute(() => jobBlogViews());

/** Never statically cached: must run on every cron hit. */
export const dynamic = "force-dynamic";
