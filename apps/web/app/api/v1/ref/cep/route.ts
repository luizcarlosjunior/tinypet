import { handler, ok, lookupCep, Errors } from "@/server";
export const GET = handler(async (req) => {
  const cep = req.nextUrl.searchParams.get("cep") ?? "";
  const r = await lookupCep(cep);
  if (!r) throw Errors.notFound("CEP não encontrado");
  return ok(r);
});
