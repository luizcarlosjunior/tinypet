import React from "react";
import { Alert, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { formatBRL, INSTALLMENT_STATUS_LABEL } from "@tinypet/shared";
import { useAcceptContract, useMyContract } from "@/hooks/use-me";
import { errorMessage } from "@/lib/api";
import { fmtDate, fmtDateTime, fmtDay } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import { Badge, Button, Card, ErrorState, KeyValue, ListItem, Loading, Screen, Section, Text } from "@/components/ui";
import { statusTone } from "@/components/ui/Badge";
import { BackHeader } from "@/components/BackHeader";

export default function ContractDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useMyContract(id);
  const accept = useAcceptContract();
  const c = q.data;
  const needsAccept = c && !c.acceptedAt && c.status !== "CANCELED";

  const doAccept = () =>
    Alert.alert("Aceitar contrato?", "Ao aceitar, data, hora e IP serão registrados como assinatura eletrônica.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Aceitar", onPress: () => accept.mutateAsync(id).then(() => Alert.alert("Contrato aceito")).catch((e) => Alert.alert("Erro", errorMessage(e))) },
    ]);

  return (
    <>
      <BackHeader title="Contrato" fallback="/(tutor)/contratos" />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {c ? (
          <>
            <Text variant="title">{c.title}</Text>
            <Text tone="muted">{c.partner?.tradeName}</Text>
            {c.description ? <Text style={{ marginTop: spacing.sm }}>{c.description}</Text> : null}
            <Card style={{ marginTop: spacing.md }}>
              <KeyValue k="Valor total" v={formatBRL(c.totalAmount ?? c.total)} />
              {c.discount && Number(c.discount) > 0 ? <KeyValue k="Desconto" v={formatBRL(c.discount)} /> : null}
              {c.discount && Number(c.discount) > 0 && c.netAmount != null ? <KeyValue k="Valor final" v={formatBRL(c.netAmount)} /> : null}
              {c.paidAmount != null && Number(c.paidAmount) > 0 ? <KeyValue k="Pago" v={formatBRL(c.paidAmount)} /> : null}
              {c.balance != null && Number(c.paidAmount ?? 0) > 0 ? <KeyValue k="Saldo" v={formatBRL(c.balance)} /> : null}
              <KeyValue k="Parcelas" v={`${c.installmentsCount}x`} />
              {c.sessionsCount ? <KeyValue k="Sessões" v={String(c.sessionsCount)} /> : null}
              <KeyValue k="Pets" v={(c.pets ?? []).map((p) => p.name).join(", ")} />
              <KeyValue k="Aceite" v={c.acceptedAt ? `Aceito em ${fmtDateTime(c.acceptedAt)}` : "Pendente"} />
            </Card>
            {c.items?.length ? (
              <Section title="Itens">
                {c.items.map((it, i) => (
                  <ListItem key={it.id ?? i} title={it.description} subtitle={`${it.quantity} × ${formatBRL(it.unitPrice)}`} chevron={false} />
                ))}
              </Section>
            ) : null}
            {c.terms ? (
              <Section title="Termos">
                <Card>
                  <Text variant="small">{c.terms}</Text>
                </Card>
              </Section>
            ) : null}
            {c.installments?.length ? (
              <Section title="Parcelas">
                {c.installments.map((i) => (
                  <ListItem key={i.id} title={`${i.number}ª · ${formatBRL(i.amount)}`} subtitle={`Vence ${fmtDay(i.dueDate)}`} right={<Badge label={INSTALLMENT_STATUS_LABEL[i.status]} tone={statusTone(i.status)} />} chevron={false} />
                ))}
              </Section>
            ) : null}
            {needsAccept ? (
              <View style={{ marginTop: spacing.md }}>
                <Button title="Aceitar contrato" size="lg" onPress={doAccept} loading={accept.isPending} />
                <Text variant="tiny" tone="faint" style={{ textAlign: "center", marginTop: 6, color: t.inkFaint }}>
                  Leia os termos antes de aceitar.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </Screen>
    </>
  );
}
