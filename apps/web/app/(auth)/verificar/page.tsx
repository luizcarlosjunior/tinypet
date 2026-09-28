"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { useSessionContext, sessionContextKey } from "@/hooks/use-session-context";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { safeNext } from "@/components/forms/social-buttons";

export default function VerificarPage() {
  return (
    <Suspense fallback={null}>
      <Verificar />
    </Suspense>
  );
}

function Verificar() {
  const sp = useSearchParams();
  const router = useRouter();
  const next = safeNext(sp.get("next"));
  const { user, isLoggedIn, sessionStatus } = useSessionContext();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const autoSent = useRef(false);

  const send = useMutation({
    mutationFn: () => api("/auth/verify", { method: "POST", json: { channel: "EMAIL" } }),
    onSuccess: () => {
      setSent(true);
      toast("Código enviado para seu e-mail.", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const confirm = useMutation({
    mutationFn: () => api("/auth/verify", { method: "PUT", json: { channel: "EMAIL", code } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionContextKey });
      toast("E-mail verificado!", "success");
      router.push(next);
    },
    onError: (e) => toast(errorMessage(e, "Código inválido ou expirado."), "error"),
  });

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.replace(`/entrar?next=${encodeURIComponent(`/verificar?next=${encodeURIComponent(next)}`)}`);
  }, [sessionStatus, router, next]);
  useEffect(() => {
    if (isLoggedIn && user && !user.emailVerified && !autoSent.current && sp.get("resend") !== "0") {
      autoSent.current = true;
      // The register endpoint already sends a code; only auto-send when explicitly asked.
      if (sp.get("send") === "1") send.mutate();
    }
  }, [isLoggedIn, user, sp, send]);

  return (
    <div className="card text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        <MailCheck className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-3 text-xl font-bold">Verifique seu e-mail</h1>
      {user?.emailVerified ? (
        <>
          <p className="mt-2 text-sm text-[var(--muted)]">Seu e-mail já está verificado.</p>
          <Link href={next} className="btn-primary mt-4">
            Continuar
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enviamos um código de 6 dígitos para <strong>{user?.email ?? "seu e-mail"}</strong>. Digite abaixo para confirmar.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) confirm.mutate();
            }}
            className="mt-4 space-y-3 text-left"
          >
            <Input id="code" label="Código" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="text-center text-lg tracking-[0.4em]" />
            <Button type="submit" className="w-full" disabled={code.length !== 6} loading={confirm.isPending}>
              Confirmar
            </Button>
          </form>
          <button type="button" onClick={() => send.mutate()} disabled={send.isPending} className="mt-3 text-sm text-brand-600 hover:underline dark:text-brand-400">
            {send.isPending ? "Enviando…" : sent ? "Reenviar código" : "Não recebeu? Enviar novamente"}
          </button>
          <p className="mt-4 text-xs text-[var(--muted)]">
            <Link href={next} className="hover:underline">
              Fazer isso depois
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
