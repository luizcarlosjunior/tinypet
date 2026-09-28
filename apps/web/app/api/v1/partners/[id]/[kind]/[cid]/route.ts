import type { z } from "zod";
import { phoneSchema, emailSchema, addressSchema } from "@tinypet/shared";
import type { PhoneInput, EmailInput, AddressInput } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize, Errors } from "@/server";
import { CONTACT_KINDS, updateContact, deleteContact, type ContactKind } from "@/server/partners";

function kindOf(v: string): ContactKind {
  if (!(CONTACT_KINDS as string[]).includes(v)) throw Errors.notFound();
  return v as ContactKind;
}
type ContactPatch = Partial<PhoneInput | EmailInput | AddressInput>;
const schemas: Record<ContactKind, z.ZodType<ContactPatch, z.ZodTypeDef, unknown>> = { phones: phoneSchema.partial(), emails: emailSchema.partial(), addresses: addressSchema.partial() };

export const PATCH = handler<{ id: string; kind: string; cid: string }>(async (req, { params }) => {
  const kind = kindOf(params.kind);
  const ctx = await requirePartner(req, params.id);
  const body = await parseBody(req, schemas[kind]);
  return ok(serialize(await updateContact(ctx.partnerId, kind, params.cid, body)));
});

export const DELETE = handler<{ id: string; kind: string; cid: string }>(async (req, { params }) => {
  const kind = kindOf(params.kind);
  const ctx = await requirePartner(req, params.id);
  await deleteContact(ctx.partnerId, kind, params.cid);
  return ok({ deleted: true });
});
