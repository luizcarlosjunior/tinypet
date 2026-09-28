"use client";
import Link from "next/link";
import { Crown } from "lucide-react";
import { isPlanLimit, planLimitInfo } from "@/lib/errors";
import { cn } from "@/lib/utils";

export const FEATURE_LABEL: Record<string, string> = {
  courses: "Cursos",
  lessons_per_course: "Aulas por curso",
  paid_courses: "Cursos pagos",
  catalog_items: "Itens no catálogo",
  crm_clients: "Clientes no CRM",
  team_members: "Profissionais na equipe",
  online_booking: "Agenda online para tutores",
  active_contracts: "Contratos ativos",
  storage_mb: "Armazenamento de mídia (MB)",
  whatsapp_reminders: "Lembretes por WhatsApp",
  custom_badges: "Badges próprias",
  search_highlight: "Destaque na busca",
  advanced_reports: "Relatórios avançados",
  owner_pets: "Pets cadastrados",
  owner_gallery: "Galeria",
  owner_stories: "Stories",
  owner_storage_mb: "Armazenamento (MB)",
};

/** Shows an upgrade notice when `error` is a 402 PLAN_LIMIT. Renders nothing otherwise. */
export function PlanLimitNotice({ error, className, compact }: { error?: unknown; className?: string; compact?: boolean }) {
  if (!isPlanLimit(error)) return null;
  const info = planLimitInfo(error);
  const label = info.featureKey ? FEATURE_LABEL[info.featureKey] ?? info.featureKey : "este recurso";
  const isBool = info.limit === 0 || info.limit === null;
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100", className)}>
      <Crown className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">Limite do plano atingido</p>
        <p className="mt-0.5">
          {isBool ? (
            <>
              <strong>{label}</strong> não está disponível no plano {info.planKey ?? "atual"}.
            </>
          ) : (
            <>
              <strong>{label}</strong>: você usa {info.current ?? "—"} de {info.limit ?? "—"} no plano {info.planKey ?? "atual"}.
            </>
          )}
        </p>
        {!compact && (
          <Link href="/painel/plano" className="mt-2 inline-flex text-sm font-medium underline underline-offset-2">
            Ver planos e fazer upgrade
          </Link>
        )}
      </div>
    </div>
  );
}
