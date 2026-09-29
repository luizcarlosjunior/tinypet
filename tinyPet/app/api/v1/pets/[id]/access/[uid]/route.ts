import { fail } from "@/server";

/** Removed: use `DELETE /pets/:id/shares/:userId` (owner) or `POST /pets/:id/leave` (shared account). */
export const DELETE = async () =>
  fail(410, "GONE", "O compartilhamento agora é feito por convite: para remover uma conta use Compartilhamento na ficha do pet (ou \"Sair do compartilhamento\").");
