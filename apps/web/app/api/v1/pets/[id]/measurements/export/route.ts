import { handler } from "@/server";
import { petActor, measurementsFor, measurementsHtml } from "@/server/pets";

/** Printable HTML (save as PDF from the browser) with the full measurement history. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  const data = await measurementsFor(params.id, "all");
  return new Response(measurementsHtml(data), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
});
