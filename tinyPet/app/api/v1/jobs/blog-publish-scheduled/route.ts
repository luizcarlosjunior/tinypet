import { cronRoute } from "@/server/jobs";
import { jobBlogPublishScheduled } from "@/server/blog/jobs";

export const { GET, POST } = cronRoute(() => jobBlogPublishScheduled());

/** Never statically cached: must run on every cron hit. */
export const dynamic = "force-dynamic";
