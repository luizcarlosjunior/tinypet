import { z } from "zod";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { ownerCancelAppointment } from "@/server/scheduling";

const schema = z.object({ reason: z.string().min(2, "Informe o motivo").max(500) });

/** POST /me/appointments/:id/cancel {reason} → CANCELED (respects partner.cancellationHours for CONFIRMED). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const body = await parseBody(req, schema);
  return ok(serialize(await ownerCancelAppointment(user, params.id, body.reason)));
});
