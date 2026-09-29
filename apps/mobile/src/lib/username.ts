import { USERNAME_HINT as SHARED_HINT, USERNAME_RE as SHARED_RE, usernameProblem as sharedProblem } from "@tinypet/shared";

/** Username rules live in @tinypet/shared (same as the API): lowercase, 3–30 chars, `^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$`, no "..", not reserved. */
export const USERNAME_RE = SHARED_RE;
export const USERNAME_HINT = SHARED_HINT;

/** pt-BR text for the API / shared reason codes (`INVALID`, `RESERVED`, `TAKEN`). */
export function usernameReasonText(reason?: string | null): string {
  switch (reason) {
    case "TAKEN":
      return "Este nome de usuário já está em uso. Escolha outro.";
    case "RESERVED":
      return "Este nome de usuário é reservado. Escolha outro.";
    case "INVALID":
      return "Nome de usuário inválido.";
    default:
      return reason || "Este nome de usuário não está disponível.";
  }
}

/** Local validation message (null when valid or empty). */
export function usernameProblem(u: string): string | null {
  if (!u) return null;
  if (u.length < 3) return "Mínimo de 3 caracteres.";
  if (u.length > 30) return "Máximo de 30 caracteres.";
  const p = sharedProblem(u);
  if (p === "INVALID") return "Use letras minúsculas, números, ponto ou sublinhado, começando e terminando com letra ou número (sem “..”).";
  if (p) return usernameReasonText(p);
  return null;
}

/** "@user" or null. */
export function atUser(u?: string | null): string | null {
  return u ? `@${u}` : null;
}
