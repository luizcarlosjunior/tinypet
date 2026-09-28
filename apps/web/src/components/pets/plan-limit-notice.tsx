import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { PlanLimitError } from "@tinypet/shared";

const FEATURE_LABEL: Record<string, string> = {
  owner_pets: "pets",
  owner_gallery: "galeria",
  owner_stories: "stories",
  owner_storage_mb: "MB de armazenamento",
};

export function PlanLimitNotice({ limit, title = "Limite do plano atingido" }: { limit: PlanLimitError; title?: string }) {
  const feature = FEATURE_LABEL[limit.featureKey] ?? limit.featureKey;
  return (
    <div role="alert" className="rounded-2xl border border-brand-300 bg-brand-50 p-4 text-sm dark:border-brand-800 dark:bg-brand-900/20">
      <p className="flex items-center gap-2 font-semibold text-brand-800 dark:text-brand-200">
        <Sparkles className="h-4 w-4" aria-hidden /> {title}
      </p>
      <p className="mt-1 text-brand-900/80 dark:text-brand-100/80">
        {limit.limit != null && limit.limit > 0 ? (
          <>
            Seu plano permite {limit.limit} {feature} e você já usa {limit.current}.
          </>
        ) : (
          <>Este recurso ({feature}) está disponível no plano Plus.</>
        )}{" "}
        Faça upgrade para continuar.
      </p>
      <Link href="/conta#plano" className="btn-primary mt-3">
        Ver planos
      </Link>
    </div>
  );
}
