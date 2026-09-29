import type { z } from "zod";
import { phoneSchema, emailSchema, addressSchema } from "@tinypet/shared";
import type { PhoneInput, EmailInput, AddressInput } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize, Errors } from "@/server";
import { CONTACT_KINDS, listContacts, createContact, type ContactKind } from "@/server/partners";

/** Contacts: /partners/:id/phones|emails|addresses */
function kindOf(v: string): ContactKind {
  if (!(CONTACT_KINDS as string[]).includes(v)) throw Errors.notFound();
  return v as ContactKind;
}
type ContactBody = PhoneInput | EmailInput | AddressInput;
const schemas: Record<ContactKind, z.ZodType<ContactBody, z.ZodTypeDef, unknown>> = { phones: phoneSchema, emails: emailSchema, addresses: addressSchema };

export const GET = handler<{ id: string; kind: string }>(async (req, { params }) => {
  const kind = kindOf(params.kind);
  const ctx = await requirePartner(req, params.id);
  return ok(serialize(await listContacts(ctx.partnerId, kind)));
});

export const POST = handler<{ id: string; kind: string }>(async (req, { params }) => {
  const kind = kindOf(params.kind);
  const ctx = await requirePartner(req, params.id);
  const body = await parseBody(req, schemas[kind]);
  return ok(serialize(await createContact(ctx.partnerId, kind, body)), { status: 201 });
});
