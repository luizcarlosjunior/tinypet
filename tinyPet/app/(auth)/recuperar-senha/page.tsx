import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <div className="card text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        <KeyRound className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-3 text-xl font-bold">Recuperar senha</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">A recuperação de senha por e-mail chega em breve. Enquanto isso, fale com a gente em suporte@tinypet.app e ajudamos você a voltar.</p>
      <Link href="/entrar" className="btn-secondary mt-5">
        Voltar para entrar
      </Link>
    </div>
  );
}
