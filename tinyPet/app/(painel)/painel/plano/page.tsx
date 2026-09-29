"use client";
import { Check, Crown, Minus } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { QueryState, UsageBar } from "@/components/painel/ui";
import { FEATURE_LABEL } from "@/components/painel/PlanLimitNotice";
import { useActivePartner, usePartnerPlan } from "@/hooks/use-partner";
import { cn } from "@/lib/utils";

const PLAN_NAME: Record<string, string> = { free: "Free", pro: "Pro", business: "Business" };

const COMPARISON: { label: string; free: string | boolean; pro: string | boolean; business: string | boolean }[] = [
  { label: "Cursos", free: "1", pro: "5", business: "Ilimitado" },
  { label: "Aulas por curso", free: "5", pro: "30", business: "Ilimitado" },
  { label: "Cursos pagos", free: false, pro: true, business: true },
  { label: "Itens no catálogo", free: "10", pro: "100", business: "Ilimitado" },
  { label: "Clientes no CRM", free: "50", pro: "1.000", business: "Ilimitado" },
  { label: "Profissionais na equipe", free: "1", pro: "5", business: "20" },
  { label: "Agenda online para tutores", free: true, pro: true, business: true },
  { label: "Contratos ativos", free: "5", pro: "Ilimitado", business: "Ilimitado" },
  { label: "Armazenamento de mídia", free: "1 GB", pro: "20 GB", business: "100 GB" },
  { label: "Lembretes por WhatsApp", free: false, pro: true, business: true },
  { label: "Badges próprias", free: false, pro: true, business: true },
  { label: "Destaque na busca", free: false, pro: false, business: true },
];

const QUANTITY_ORDER = ["catalog_items", "crm_clients", "team_members", "active_contracts", "courses", "lessons_per_course", "storage_mb"];

export default function PlanoPage() {
  const { partnerId } = useActivePartner();
  const plan = usePartnerPlan(partnerId);
  const p = plan.data;
  const planKey = (p?.planKey ?? "free").toLowerCase();

  return (
    <div>
      <PageHeader title="Plano" description="Uso atual e comparação entre os planos do parceiro." />
      <QueryState isLoading={plan.isLoading} error={plan.error} retry={() => plan.refetch()}>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <Crown className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Plano atual</p>
                <p className="text-xl font-bold">{PLAN_NAME[planKey] ?? p?.planKey ?? "—"}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-[var(--muted)]">A cobrança da assinatura chega em uma próxima fase. Até lá, a equipe tinyPet libera planos manualmente.</p>
            <a href="mailto:contato@tinypet.app?subject=Upgrade%20de%20plano" className="btn-primary mt-4 w-full">
              Falar com a equipe
            </a>
          </Card>
          <Card className="lg:col-span-2" title="Uso do plano">
            <div className="grid gap-4 sm:grid-cols-2">
              {p &&
                [...QUANTITY_ORDER, ...Object.keys(p.limits).filter((k) => !QUANTITY_ORDER.includes(k))]
                  .filter((k) => p.limits[k])
                  .map((k) => {
                    const l = p.limits[k]!;
                    const isBool = l.quantity === undefined || (l.quantity === null && !l.enabled) || ["online_booking", "paid_courses", "whatsapp_reminders", "custom_badges", "search_highlight", "advanced_reports"].includes(k);
                    if (isBool)
                      return (
                        <div key={k} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                          <span className="font-medium">{FEATURE_LABEL[k] ?? k}</span>
                          {l.enabled ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                              <Check className="h-4 w-4" aria-hidden /> Liberado
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[var(--muted)]">
                              <Minus className="h-4 w-4" aria-hidden /> Indisponível
                            </span>
                          )}
                        </div>
                      );
                    return <UsageBar key={k} label={FEATURE_LABEL[k] ?? k} used={p.usage?.[k] ?? 0} limit={l.quantity} enabled={l.enabled} />;
                  })}
            </div>
          </Card>
        </div>

        <Card className="mt-6 overflow-x-auto" title="Comparação de planos">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Recurso</th>
                {(["free", "pro", "business"] as const).map((k) => (
                  <th key={k} className={cn("px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide", planKey === k ? "rounded-t-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "text-[var(--muted)]")}>
                    {PLAN_NAME[k]}
                    {planKey === k && <span className="block text-[10px] font-normal normal-case">seu plano</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((r) => (
                <tr key={r.label} className="border-t">
                  <td className="px-3 py-2">{r.label}</td>
                  {(["free", "pro", "business"] as const).map((k) => {
                    const v = r[k];
                    return (
                      <td key={k} className={cn("px-3 py-2 text-center", planKey === k && "bg-brand-50/60 dark:bg-brand-900/10")}>
                        {typeof v === "boolean" ? v ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Sim" /> : <Minus className="mx-auto h-4 w-4 text-[var(--muted)]" aria-label="Não" /> : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-[var(--muted)]">Valores dos planos pagos a definir. Pacotes adicionais (add-ons) somam capacidade a qualquer plano pago.</p>
        </Card>
      </QueryState>
    </div>
  );
}
