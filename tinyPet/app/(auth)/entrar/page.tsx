"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@tinypet/shared";
import { Button, Input } from "@/components/ui";
import { SocialButtons, safeNext } from "@/components/forms/social-buttons";

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
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(v: LoginInput) {
    setError(null);
    const r = await signIn("credentials", { email: v.email, password: v.password, redirect: false });
    if (r?.error) return setError("E-mail ou senha incorretos.");
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
