"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@tinypet/shared";
import { Button, Input } from "@/components/ui";
import { SocialButtons, safeNext } from "@/components/forms/social-buttons";
import { RECAPTCHA_NOTICE, RECAPTCHA_SITE_KEY, captchaToken, loadRecaptcha } from "@/lib/recaptcha";

const CAPTCHA_MSG: Record<string, string> = {
  CAPTCHA_REQUIRED: "Confirme que você não é um robô: recarregue a página e tente de novo.",
  CAPTCHA_FAILED: "Não conseguimos confirmar que você não é um robô. Tente novamente.",
  CAPTCHA_UNAVAILABLE: "Verificação anti-robô indisponível. Tente novamente em instantes.",
};

const LOGIN_ERRORS: Record<string, string> = {
  suspensa: "Sua conta está suspensa por violar as regras da comunidade. Entre em contato com o suporte se achar que foi um engano.",
  bloqueado: "O acesso a partir desta rede está bloqueado temporariamente por violar as regras da comunidade.",
};

export default function EntrarPage() {
  return (
    <Suspense fallback={null}>
      <EntrarForm />
    </Suspense>
  );
}

function EntrarForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const next = safeNext(sp.get("next") ?? sp.get("callbackUrl"));
  const [error, setError] = useState<string | null>(LOGIN_ERRORS[sp.get("erro") ?? ""] ?? null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  useEffect(() => void loadRecaptcha(), []);

  async function onSubmit(v: LoginInput) {
    setError(null);
    const r = await signIn("credentials", { email: v.email, password: v.password, captchaToken: (await captchaToken("login")) ?? "", redirect: false });
    // authorize() throws pt-BR messages for suspended accounts, blocked IPs and rate limits; wrong credentials → "CredentialsSignin".
    if (r?.error) return setError(CAPTCHA_MSG[r.error] ?? (r.error === "CredentialsSignin" ? "E-mail ou senha incorretos." : r.error));
    router.push(next);
    router.refresh();
  }

  return (
    <div className="card">
      <h1 className="text-xl font-bold">Entrar</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Bem-vindo de volta! Seus pets sentiram sua falta.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3" noValidate>
        <Input id="email" type="email" label="E-mail" autoComplete="email" {...register("email")} error={errors.email?.message} />
        <Input id="password" type="password" label="Senha" autoComplete="current-password" {...register("password")} error={errors.password?.message} />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Entrar
        </Button>
        {RECAPTCHA_SITE_KEY && <p className="text-center text-[11px] text-[var(--muted)]">{RECAPTCHA_NOTICE}</p>}
      </form>
      <div className="mt-3 text-right">
        <Link href="/recuperar-senha" className="text-xs text-brand-600 hover:underline dark:text-brand-400">
          Esqueci minha senha
        </Link>
      </div>
      <SocialButtons callbackUrl={next} />
      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Ainda não tem conta?{" "}
        <Link href={`/cadastro${sp.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
