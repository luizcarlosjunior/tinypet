import { handler, Errors } from "@/server";
import { icsForToken } from "@/server/ical";

/** GET /schedule/ical/:calendarToken (public) → text/calendar with the professional's upcoming appointments. */
export const GET = handler<{ calendarToken: string }>(async (_req, { params }) => {
  const ics = await icsForToken(params.calendarToken);
  if (!ics) throw Errors.notFound("Calendário não encontrado");
  return new Response(ics, { status: 200, headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="tinypet.ics"', "Cache-Control": "private, max-age=300" } });
});
