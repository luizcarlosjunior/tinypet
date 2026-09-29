"use client";
import { useMemo, useState } from "react";
import { Badge, Button, Input, PageHeader, Select } from "@/components/ui";
import { Checkbox, ConfirmDialog, QueryState, Table, td, th } from "@/components/painel/ui";
import { useAdminFeatures, useAdminMutations, useAdminPlans, type AdminPlan } from "@/hooks/use-admin";
import { FEATURE_LABEL } from "@/components/painel/PlanLimitNotice";
import { FEATURES, formatBRL } from "@tinypet/shared";
import { CreateForm, type FieldDef } from "@/components/admin/AdminTable";
import { cn } from "@/lib/utils";

const OWNER_KEYS = ["owner_pets", "owner_gallery", "owner_stories", "owner_storage_mb", "owner_videos_per_day", "owner_video_max_seconds"];
const BOOLEAN_KEYS = ["paid_courses", "online_booking", "whatsapp_reminders", "custom_badges", "search_highlight", "advanced_reports", "owner_gallery", "owner_stories"];

const planFields: FieldDef[] = [
  { key: "key", label: "Chave", required: true, placeholder: "pro" },
  { key: "name", label: "Nome", required: true, placeholder: "Pro" },
  { key: "audience", label: "Público", type: "select", required: true, options: [{ value: "PARTNER", label: "Parceiro" }, { value: "OWNER", label: "Tutor" }] },
  { key: "priceMonthly", label: "Preço mensal (R$)", type: "number", decimal: true, emptyAs: "null" },
  { key: "priceYearly", label: "Preço anual (R$)", type: "number", decimal: true, emptyAs: "null" },
  { key: "trialDays", label: "Dias de teste", type: "number" },
  { key: "visible", label: "Visível", type: "checkbox" },
  { key: "isDefault", label: "Padrão", type: "checkbox" },
];

export default function PlanosPage() {
  const plans = useAdminPlans();
  const features = useAdminFeatures();
  const m = useAdminMutations("plans");
  const [editing, setEditing] = useState<string | null>(null);
  const [del, setDel] = useState<AdminPlan | null>(null);

  const featureList = useMemo(() => {
    const fromApi = features.data?.items ?? [];
    if (fromApi.length) return fromApi.map((f) => ({ key: f.key, label: f.label ?? FEATURE_LABEL[f.key] ?? f.key, kind: f.kind ?? (BOOLEAN_KEYS.includes(f.key) ? "BOOLEAN" : "QUANTITY"), audience: f.audience ?? (OWNER_KEYS.includes(f.key) ? "OWNER" : "PARTNER") }));
    return Object.values(FEATURES).map((k) => ({ key: k, label: FEATURE_LABEL[k] ?? k, kind: BOOLEAN_KEYS.includes(k) ? "BOOLEAN" : "QUANTITY", audience: OWNER_KEYS.includes(k) ? "OWNER" : "PARTNER" }));
  }, [features.data]);

  const rows = [...(plans.data?.items ?? [])].sort((a, b) => a.audience.localeCompare(b.audience) || Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));

  return (
    <div className="space-y-4">
      <PageHeader title="Planos e limites" description="Cada plano define, recurso por recurso, o que está liberado e quanto. Quantidade vazia = ilimitado." />
      <CreateForm fields={planFields} title="Novo plano" idPrefix="new-plan" submitting={m.create.isPending} onSubmit={(b) => m.create.mutateAsync({ ...b, trialDays: b.trialDays ?? 0 })} />
      <QueryState isLoading={plans.isLoading} error={plans.error} retry={() => plans.refetch()}>
        <Table>
          <thead>
            <tr>
              <th className={th}>Plano</th>
              <th className={th}>Público</th>
              <th className={th}>Mensal</th>
              <th className={th}>Anual</th>
              <th className={th}>Teste</th>
              <th className={th}>Visível</th>
              <th className={th}>Padrão</th>
              <th className={cn(th, "text-right")}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className={cn(td, "py-6 text-center text-[var(--muted)]")}>
                  Nenhum plano cadastrado.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <PlanRow key={p.id} plan={p} editing={editing === p.id} onEdit={() => setEditing(editing === p.id ? null : p.id)} onDelete={() => setDel(p)} features={featureList.filter((f) => f.audience === p.audience)} saving={m.update.isPending} onSave={(body) => m.update.mutateAsync({ id: p.id, body }).then(() => setEditing(null))} />
            ))}
          </tbody>
        </Table>
      </QueryState>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title={`Remover o plano ${del?.name}?`} description="Assinaturas vinculadas podem ficar sem plano. Prefira torná-lo invisível." confirmLabel="Remover" danger loading={m.remove.isPending} onConfirm={() => del && m.remove.mutate(del.id, { onSuccess: () => setDel(null) })} />
    </div>
  );
}

function PlanRow({ plan, editing, onEdit, onDelete, features, onSave, saving }: { plan: AdminPlan; editing: boolean; onEdit: () => void; onDelete: () => void; features: { key: string; label: string; kind: string }[]; onSave: (body: Record<string, unknown>) => Promise<unknown>; saving: boolean }) {
  return (
    <>
      <tr>
        <td className={td}>
          <span className="font-medium">{plan.name}</span> <code className="ml-1 text-xs text-[var(--muted)]">{plan.key}</code>
        </td>
        <td className={td}>{plan.audience === "OWNER" ? <Badge tone="blue">Tutor</Badge> : <Badge tone="brand">Parceiro</Badge>}</td>
        <td className={td}>{plan.priceMonthly == null ? "—" : formatBRL(plan.priceMonthly)}</td>
        <td className={td}>{plan.priceYearly == null ? "—" : formatBRL(plan.priceYearly)}</td>
        <td className={td}>{plan.trialDays ? `${plan.trialDays} dias` : "—"}</td>
        <td className={td}>{plan.visible === false ? <Badge tone="gray">Não</Badge> : <Badge tone="green">Sim</Badge>}</td>
        <td className={td}>{plan.isDefault ? <Badge tone="green">Sim</Badge> : <Badge tone="gray">Não</Badge>}</td>
        <td className={cn(td, "text-right")}>
          <div className="inline-flex gap-1">
            <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={onEdit} aria-expanded={editing}>
              {editing ? "Fechar" : "Editar limites"}
            </Button>
            <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-red-600" onClick={onDelete}>
              Remover
            </Button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={8} className={cn(td, "bg-ink-50 dark:bg-ink-900/40")}>
            <PlanEditor plan={plan} features={features} onSave={onSave} saving={saving} />
          </td>
        </tr>
      )}
    </>
  );
}

function PlanEditor({ plan, features, onSave, saving }: { plan: AdminPlan; features: { key: string; label: string; kind: string }[]; onSave: (body: Record<string, unknown>) => Promise<unknown>; saving: boolean }) {
  const initial = useMemo(() => {
    const map: Record<string, { enabled: boolean; quantity: string }> = {};
    for (const f of features) {
      const l = plan.limits?.find((x) => x.featureKey === f.key);
      map[f.key] = { enabled: l ? l.enabled : true, quantity: l?.quantity == null ? "" : String(l.quantity) };
    }
    return map;
  }, [plan, features]);
  const [limits, setLimits] = useState(initial);
  const [meta, setMeta] = useState({ name: plan.name, priceMonthly: plan.priceMonthly == null ? "" : String(plan.priceMonthly), priceYearly: plan.priceYearly == null ? "" : String(plan.priceYearly), trialDays: String(plan.trialDays ?? 0), visible: plan.visible !== false, isDefault: !!plan.isDefault, sortOrder: String(plan.sortOrder ?? 0) });
  const id = `plan-${plan.id}`;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name: meta.name,
          priceMonthly: meta.priceMonthly === "" ? null : Number(meta.priceMonthly),
          priceYearly: meta.priceYearly === "" ? null : Number(meta.priceYearly),
          trialDays: Number(meta.trialDays || 0),
          visible: meta.visible,
          isDefault: meta.isDefault,
          sortOrder: Number(meta.sortOrder || 0),
          limits: features.map((f) => ({ featureKey: f.key, enabled: limits[f.key]?.enabled ?? true, quantity: f.kind === "BOOLEAN" || limits[f.key]?.quantity === "" || limits[f.key]?.quantity == null ? null : Number(limits[f.key]!.quantity) })),
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Input id={`${id}-name`} label="Nome" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} required />
        <Input id={`${id}-pm`} label="Mensal (R$)" type="number" step="0.01" value={meta.priceMonthly} onChange={(e) => setMeta({ ...meta, priceMonthly: e.target.value })} />
        <Input id={`${id}-py`} label="Anual (R$)" type="number" step="0.01" value={meta.priceYearly} onChange={(e) => setMeta({ ...meta, priceYearly: e.target.value })} />
        <Input id={`${id}-trial`} label="Dias de teste" type="number" value={meta.trialDays} onChange={(e) => setMeta({ ...meta, trialDays: e.target.value })} />
        <Input id={`${id}-order`} label="Ordem" type="number" value={meta.sortOrder} onChange={(e) => setMeta({ ...meta, sortOrder: e.target.value })} />
        <div className="flex flex-col justify-end gap-1">
          <Checkbox label="Visível" checked={meta.visible} onChange={(e) => setMeta({ ...meta, visible: e.target.checked })} />
          <Checkbox label="Padrão" checked={meta.isDefault} onChange={(e) => setMeta({ ...meta, isDefault: e.target.checked })} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th}>Recurso</th>
              <th className={th}>Liberado</th>
              <th className={th}>Quantidade (vazio = ilimitado)</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => {
              const l = limits[f.key] ?? { enabled: true, quantity: "" };
              return (
                <tr key={f.key}>
                  <td className={td}>
                    {f.label} <code className="ml-1 text-xs text-[var(--muted)]">{f.key}</code>
                  </td>
                  <td className={td}>
                    <Checkbox label={<span className="sr-only">Liberado: {f.label}</span>} checked={l.enabled} onChange={(e) => setLimits({ ...limits, [f.key]: { ...l, enabled: e.target.checked } })} />
                  </td>
                  <td className={td}>
                    {f.kind === "BOOLEAN" ? (
                      <span className="text-xs text-[var(--muted)]">Sim/não</span>
                    ) : (
                      <input type="number" min={0} aria-label={`Quantidade: ${f.label}`} className="input max-w-[140px]" placeholder="Ilimitado" value={l.quantity} disabled={!l.enabled} onChange={(e) => setLimits({ ...limits, [f.key]: { ...l, quantity: e.target.value } })} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          Salvar plano
        </Button>
      </div>
    </form>
  );
}
