"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { sessionContextKey, useSessionContext } from "@/hooks/use-session-context";

/**
 * Blocking modal shown when GET /auth/me reports `termsAccepted === false` (e.g. accounts created via Google/Apple
 * that never accepted the terms). Only appears when the field is explicitly `false`.
 */
export function TermsGate() {
  const { user } = useSessionContext();
  const qc = useQueryClient();
  const [checked, setChecked] = useState(false);
  const accept = useMutation({
    mutationFn: () => api("/auth/me", { method: "PATCH", json: { acceptTerms: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionContextKey }),
  });
  if (!user || user.termsAccepted !== false) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
      <div className="w-full rounded-t-2xl bg-[var(--card)] p-5 sm:max-w-md sm:rounded-2xl">
        <h2 id="terms-gate-title" className="text-lg font-semibold">
          Termos de uso e privacidade
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Para continuar usando o tinyPet, leia e aceite os{" "}
          <Link href="/termos" target="_blank" className="text-brand-600 underline dark:text-brand-400">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="text-brand-600 underline dark:text-brand-400">
            Política de privacidade
          </Link>
          .
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>Li e aceito os Termos de uso e a Política de privacidade.</span>
        </label>
        {accept.isError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {errorMessage(accept.error)}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => signOut({ callbackUrl: "/" })}>
            Sair
          </button>
          <button type="button" className="btn-primary" disabled={!checked || accept.isPending} onClick={() => accept.mutate()}>
            {accept.isPending ? "Salvando…" : "Aceitar e continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
