import { isValidCNPJ } from "@tinypet/shared";
import { handler, ok, lookupCnpj, Errors } from "@/server";
export const GET = handler(async (req) => {
  const cnpj = req.nextUrl.searchParams.get("cnpj") ?? "";
  if (!isValidCNPJ(cnpj)) throw Errors.badRequest("CNPJ inválido");
  const r = await lookupCnpj(cnpj);
  if (!r) throw Errors.notFound("CNPJ não encontrado");
  return ok(r);
});
