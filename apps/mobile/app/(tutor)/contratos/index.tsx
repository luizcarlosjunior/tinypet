import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { formatBRL, INSTALLMENT_STATUS_LABEL } from "@tinypet/shared";
import { useMyContracts, useMyInstallments } from "@/hooks/use-me";
import { fmtDate } from "@/lib/format";
import { spacing } from "@/lib/theme";
import { Badge, Empty, ErrorState, ListItem, Loading, Screen, Segmented } from "@/components/ui";
import { statusTone } from "@/components/ui/Badge";

const CONTRACT_STATUS = { DRAFT: "Aguardando aceite", ACTIVE: "Ativo", COMPLETED: "Concluído", CANCELED: "Cancelado" } as const;
const TYPE_LABEL = { PACKAGE: "Pacote", RECURRING: "Recorrente", SINGLE: "Avulso", COURSE: "Curso" } as const;

export default function Contracts() {
  const router = useRouter();
  const [tab, setTab] = useState<"contracts" | "installments">("contracts");
  const contracts = useMyContracts();
  const installments = useMyInstallments();
  const q = tab === "contracts" ? contracts : installments;

  return (
    <Screen title="Contratos e parcelas" refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
      <Segmented items={[{ key: "contracts", label: "Contratos" }, { key: "installments", label: "Parcelas" }]} value={tab} onChange={setTab} />
      <View style={{ height: spacing.md }} />
      {q.isLoading ? <Loading /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
      {tab === "contracts" && contracts.data ? (
        contracts.data.length === 0 ? (
          <Empty icon="document-text-outline" title="Nenhum contrato" description="Contratos criados pelos seus parceiros aparecem aqui para aceite." />
        ) : (
          contracts.data.map((c) => (
            <ListItem
              key={c.id}
              title={c.title}
              subtitle={[c.partner?.tradeName, TYPE_LABEL[c.type], formatBRL(c.total), `${c.installmentsCount}x`].filter(Boolean).join(" · ")}
              right={<Badge label={c.status === "DRAFT" && !c.acceptedAt ? "Aceite pendente" : CONTRACT_STATUS[c.status]} tone={c.status === "DRAFT" ? "warning" : statusTone(c.status)} />}
              onPress={() => router.push(`/(tutor)/contratos/${c.id}`)}
            />
          ))
        )
      ) : null}
      {tab === "installments" && installments.data ? (
        installments.data.length === 0 ? (
          <Empty icon="cash-outline" title="Nenhuma parcela" />
        ) : (
          [...installments.data]
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((i) => (
              <ListItem
                key={i.id}
                title={`${formatBRL(i.amount)} · parcela ${i.number}`}
                subtitle={[`Vence ${fmtDate(i.dueDate)}`, i.contract?.title, i.contract?.partner?.tradeName ?? i.partner?.tradeName, i.paidAmount && Number(i.paidAmount) > 0 && i.status !== "PAID" ? `pago ${formatBRL(i.paidAmount)}` : null].filter(Boolean).join(" · ")}
                right={<Badge label={INSTALLMENT_STATUS_LABEL[i.status]} tone={statusTone(i.status)} />}
                onPress={i.contractId || i.contract?.id ? () => router.push(`/(tutor)/contratos/${i.contractId ?? i.contract!.id}`) : undefined}
              />
            ))
        )
      ) : null}
    </Screen>
  );
}
