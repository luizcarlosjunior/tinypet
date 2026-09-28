import { z } from "zod";
import { isoDateTime } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { ownerRescheduleAppointment } from "@/server/scheduling";

const schema = z.object({ startsAt: isoDateTime });

/**
 * POST /me/appointments/:id/reschedule {startsAt} → new REQUESTED proposal (notes "reschedule:<id>").
 * The original stays until the partner confirms the proposal, which cancels it with "Remarcação solicitada".
 */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const body = await parseBody(req, schema);
  return ok(serialize(await ownerRescheduleAppointment(user, params.id, body.startsAt)), { status: 201 });
});
