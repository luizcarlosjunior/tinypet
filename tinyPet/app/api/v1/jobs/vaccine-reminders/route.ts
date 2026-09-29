import { cronRoute, jobVaccineReminders } from "@/server/jobs";

export const { GET, POST } = cronRoute(() => jobVaccineReminders());

/** Never statically cached: must run on every cron hit. */
export const dynamic = "force-dynamic";
