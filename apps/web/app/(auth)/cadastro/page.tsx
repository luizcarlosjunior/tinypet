"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@tinypet/shared";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { useOwnerTerms } from "@/hooks/use-ref";
import { Button, Input } from "@/components/ui";
import { SocialButtons, safeNext } from "@/components/forms/social-buttons";
import { OWNER_TERMS } from "@tinypet/shared";

export default function CadastroPage() {
  return (
    <Suspense fallback={null}>
      <CadastroForm />
    </Suspense>
  );
}

function CadastroForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const next = safeNext(sp.get("next"));
  const terms = useOwnerTerms();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { marketingConsent: false } });

  async function onSubmit(v: RegisterInput) {
    setError(null);
    try {
      await api("/auth/register", { method: "POST", json: v });
      const r = await signIn("credentials", { email: v.email, password: v.password, redirect: false });
      if (r?.error) {
        router.push(`/entrar?next=${encodeURIComponent(next)}`);
        return;
      }
      router.push(`/verificar?next=${encodeURIComponent(next)}`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="card">
      <h1 className="text-xl font-bold">Criar conta</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Grátis para tutores. Leva menos de um minuto.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3" noValidate>
        <Input id="name" label="Seu nome" autoComplete="name" {...register("name")} error={errors.name?.message} />
        <Input id="email" type="email" label="E-mail" autoComplete="email" {...register("email")} error={errors.email?.message} />
        <Input id="password" type="password" label="Senha (mínimo 8 caracteres)" autoComplete="new-password" {...register("password")} error={errors.password?.message} />
        <div>
          <label htmlFor="ownerTermId" className="label">
            Como você quer ser chamado(a)?
          </label>
          <select id="ownerTermId" className="input" {...register("ownerTermId", { setValueAs: (v) => v || undefined })}>
            <option value="">Padrão (Tutor)</option>
            {(terms.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {!terms.data?.length && <p className="mt-1 text-xs text-[var(--muted)]">Opções: {OWNER_TERMS.join(", ")}. Você pode mudar depois em Conta.</p>}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" {...register("acceptTerms")} className="mt-0.5 h-4 w-4 accent-brand-500" aria-invalid={!!errors.acceptTerms} />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" className="text-brand-600 underline dark:text-brand-400">
              termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank" className="text-brand-600 underline dark:text-brand-400">
              política de privacidade
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="text-xs text-red-600" role="alert">
            {errors.acceptTerms.message}
          </p>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" {...register("marketingConsent")} className="mt-0.5 h-4 w-4 accent-brand-500" />
          <span>Quero receber ofertas das marcas e parceiros que meus pets usam (opcional).</span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Criar conta
        </Button>
      </form>
      <SocialButtons callbackUrl={next} />
      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Já tem conta?{" "}
        <Link href={`/entrar${sp.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Entrar
        </Link>
      </p>
    </div>
  );
}
