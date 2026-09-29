"use client";
import { useEffect, useState } from "react";
import { normalizeUsername, usernameProblem, USERNAME_HINT } from "@tinypet/shared";
import { Input } from "@/components/ui";
import { checkUsername } from "@/hooks/use-sharing";

export type UsernameStatus = "empty" | "unchanged" | "checking" | "available" | "invalid" | "reserved" | "taken" | "error";

const MESSAGE: Partial<Record<UsernameStatus, string>> = {
  checking: "Verificando…",
  available: "Disponível",
  invalid: "Formato inválido",
  reserved: "Este nome é reservado",
  taken: "Já está em uso",
  error: "Não foi possível verificar agora",
};

/** "@username" input with the format hint and a debounced availability check (GET /auth/username-available). */
export function UsernameField({ id = "username", value, onChange, current, label = "Nome de usuário", onStatus }: { id?: string; value: string; onChange: (v: string) => void; current?: string | null; label?: string; onStatus?: (s: UsernameStatus) => void }) {
  const [status, setStatus] = useState<UsernameStatus>("empty");
  const normalized = normalizeUsername(value);

  useEffect(() => {
    let alive = true;
    const set = (s: UsernameStatus) => {
      if (!alive) return;
      setStatus(s);
      onStatus?.(s);
    };
    if (!normalized) return set("empty");
    if (current && normalized === current) return set("unchanged");
    const p = usernameProblem(normalized);
    if (p) return set(p === "RESERVED" ? "reserved" : "invalid");
    set("checking");
    const t = setTimeout(() => {
      checkUsername(normalized)
        .then((r) => set(r.available ? "available" : r.reason === "TAKEN" ? "taken" : r.reason === "RESERVED" ? "reserved" : "invalid"))
        .catch(() => set("error"));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, current]);

  const bad = status === "invalid" || status === "reserved" || status === "taken";
  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          label={label}
          value={value}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={31}
          placeholder="@seu.nome"
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          aria-describedby={`${id}-hint`}
          aria-invalid={bad || undefined}
        />
      </div>
      <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--muted)]" aria-live="polite">
        {MESSAGE[status] && <span className={bad ? "font-medium text-red-600" : status === "available" ? "font-medium text-emerald-600" : ""}>{MESSAGE[status]}. </span>}
        {USERNAME_HINT} Outras pessoas podem usar o seu @ para compartilhar pets com você.
      </p>
    </div>
  );
}

export const usernameBlocksSubmit = (s: UsernameStatus) => s === "invalid" || s === "reserved" || s === "taken" || s === "checking";
