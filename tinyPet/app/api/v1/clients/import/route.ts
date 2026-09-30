import { handler, ok, requirePartner, Errors } from "@/server";
import { readBodyCapped } from "@/server/media";

const MAX_BYTES = 5 * 1024 * 1024;
import { importClientsCsv } from "@/server/crm";

/** multipart/form-data with `file` (CSV: name,email,phone,petName,species). */
export const POST = handler(async (req) => {
  const ctx = await requirePartner(req);
  // cap the body BEFORE multipart parsing (req.formData() would buffer any size)
  const raw = await readBodyCapped(req, MAX_BYTES + 64 * 1024);
  let form: FormData;
  try {
    form = await new Request(req.url, { method: "POST", headers: { "content-type": req.headers.get("content-type") ?? "" }, body: new Uint8Array(raw) }).formData();
  } catch {
    throw Errors.badRequest("Envie o arquivo CSV como multipart/form-data (campo `file`)");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw Errors.badRequest("Arquivo `file` obrigatório");
  if (file.size > MAX_BYTES) throw Errors.badRequest("CSV acima de 5 MB");
  const text = Buffer.from(await file.arrayBuffer()).toString("utf8");
  return ok(await importClientsCsv(ctx.partnerId, text));
});
