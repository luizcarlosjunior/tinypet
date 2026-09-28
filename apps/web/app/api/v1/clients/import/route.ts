import { handler, ok, requirePartner, Errors } from "@/server";
import { importClientsCsv } from "@/server/crm";

/** multipart/form-data with `file` (CSV: name,email,phone,petName,species). */
export const POST = handler(async (req) => {
  const ctx = await requirePartner(req);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw Errors.badRequest("Envie o arquivo CSV como multipart/form-data (campo `file`)");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw Errors.badRequest("Arquivo `file` obrigatório");
  if (file.size > 5 * 1024 * 1024) throw Errors.badRequest("CSV acima de 5 MB");
  const text = Buffer.from(await file.arrayBuffer()).toString("utf8");
  return ok(await importClientsCsv(ctx.partnerId, text));
});
