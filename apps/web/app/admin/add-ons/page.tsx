"use client";
import { CrudPage } from "@/components/admin/CrudPage";
import { useAdminFeatures } from "@/hooks/use-admin";
import { FEATURE_LABEL } from "@/components/painel/PlanLimitNotice";
import { FEATURES, formatBRL } from "@tinypet/shared";
import type { FieldDef, Row } from "@/components/admin/AdminTable";

type AddOn = Row & { key: string; name: string; featureKey: string; quantity: number; priceMonthly?: number | string | null };

export default function AddOnsPage() {
  const features = useAdminFeatures();
  const keys = features.data?.items?.length ? features.data.items.map((f) => ({ value: f.key, label: f.label ?? FEATURE_LABEL[f.key] ?? f.key })) : Object.values(FEATURES).map((k) => ({ value: k, label: FEATURE_LABEL[k] ?? k }));
  const fields: FieldDef[] = [
    { key: "key", label: "Chave", required: true, placeholder: "extra_course" },
    { key: "name", label: "Nome", required: true, placeholder: "+1 curso" },
    { key: "featureKey", label: "Recurso", type: "select", options: keys, required: true },
    { key: "quantity", label: "Quantidade", type: "number", required: true },
    { key: "priceMonthly", label: "Preço mensal (R$)", type: "number", decimal: true, emptyAs: "null" },
  ];
  return (
    <CrudPage<AddOn>
      resource="add-ons"
      title="Add-ons"
      description="Pacotes adicionais que somam capacidade a qualquer plano pago (ex.: +1 curso, +5 GB)."
      fields={fields}
      columns={[
        { key: "name", label: "Add-on" },
        { key: "key", label: "Chave", render: (r) => <code className="text-xs">{r.key}</code> },
        { key: "featureKey", label: "Recurso", render: (r) => keys.find((k) => k.value === r.featureKey)?.label ?? r.featureKey },
        { key: "quantity", label: "Quantidade" },
        { key: "priceMonthly", label: "Preço/mês", render: (r) => (r.priceMonthly == null ? "—" : formatBRL(r.priceMonthly)) },
      ]}
    />
  );
}
