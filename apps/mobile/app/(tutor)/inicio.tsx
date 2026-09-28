import React from "react";
import { Alert, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { formatBRL } from "@tinypet/shared";
import { useAuth } from "@/lib/auth-store";
import { useHome } from "@/hooks/use-me";
import { useTaskMutations } from "@/hooks/use-pets";
import { errorMessage } from "@/lib/api";
import { fmtDate, fmtDayLong } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { PetTask } from "@/lib/types";
import { Avatar, Button, Card, Checkbox, Empty, ErrorState, Loading, Screen, Section, Text } from "@/components/ui";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { describeRule } from "@/components/pets/RotinaTab";

function TaskRow({ task }: { task: PetTask }) {
  const petId = task.petId ?? task.pet?.id ?? "";
  const { complete } = useTaskMutations(petId);
  return (
    <Checkbox
      checked={!!task.completedToday}
      disabled={!!task.completedToday || !petId}
      onChange={() => complete.mutateAsync({ tid: task.id }).catch((e) => Alert.alert("Erro", errorMessage(e)))}
      label={task.title}
      description={[task.pet?.name, describeRule(task.rule, task.dueAt)].filter(Boolean).join(" · ")}
    />
  );
}

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const q = useHome();
  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <Screen title={`Olá, ${firstName}`} subtitle={fmtDayLong(new Date())} refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch} right={<Button title="Buscar" size="sm" variant="secondary" icon="search" onPress={() => router.push("/(tutor)/buscar")} accessibilityLabel="Buscar parceiros" />}>
      {q.isLoading ? <Loading /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
      {q.data ? (
        <>
          {q.data.pets?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, marginBottom: spacing.xl }}>
              {q.data.pets.map((p) => (
                <View key={p.id} style={{ alignItems: "center", width: 64 }}>
                  <Avatar uri={p.avatarUrl} name={p.name} species={p.speciesKey} size={56} />
                  <Text variant="tiny" tone="muted" numberOfLines={1} style={{ marginTop: 4 }} onPress={() => router.push(`/(tutor)/pets/${p.id}`)}>
                    {p.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Card onPress={() => router.push("/(tutor)/pets/novo")} accessibilityLabel="Cadastrar primeiro pet" style={{ backgroundColor: t.primarySoft, borderColor: t.primary }}>
              <Text variant="h3">Cadastre seu primeiro pet</Text>
              <Text variant="small" tone="muted">
                Ficha, galeria, rotina e histórico em um só lugar.
              </Text>
            </Card>
          )}

          {q.data.overdueInstallments?.length ? (
            <Card style={{ backgroundColor: t.dangerSoft, borderColor: t.danger }} onPress={() => router.push("/(tutor)/contratos")} accessibilityLabel="Ver parcelas vencidas">
              <Text variant="h3" style={{ color: t.danger }}>
                {q.data.overdueInstallments.length} {q.data.overdueInstallments.length === 1 ? "parcela vencida" : "parcelas vencidas"}
              </Text>
              <Text variant="small" tone="muted">
                Total {formatBRL(q.data.overdueInstallments.reduce((s, i) => s + Number(i.amount) - Number(i.paidAmount ?? 0), 0))}
              </Text>
            </Card>
          ) : null}

          <Section title="Tarefas de hoje">
            {q.data.tasksToday.length === 0 ? (
              <Text variant="small" tone="muted">
                Nenhuma tarefa para hoje.
              </Text>
            ) : (
              q.data.tasksToday.map((task) => <TaskRow key={task.id} task={task} />)
            )}
          </Section>

          <Section title="Próximas visitas" right={<Button title="Ver agenda" size="sm" variant="ghost" onPress={() => router.push("/(tutor)/agenda")} />}>
            {q.data.upcomingAppointments.length === 0 ? <Empty icon="calendar-outline" title="Nenhuma visita marcada" action="Encontrar parceiros" onAction={() => router.push("/(tutor)/buscar")} /> : null}
            {q.data.upcomingAppointments.slice(0, 5).map((a) => (
              <AppointmentCard key={a.id} a={a} side="owner" showDate onPress={() => router.push(`/(tutor)/agenda/${a.id}`)} />
            ))}
          </Section>

          {q.data.recentBadges?.length ? (
            <Section title="Conquistas recentes">
              {q.data.recentBadges.map((b, i) => (
                <Card key={`${b.key}-${i}`} onPress={b.pet ? () => router.push(`/(tutor)/pets/${b.pet!.id}`) : undefined}>
                  <Text variant="h3">{b.name}</Text>
                  <Text variant="small" tone="muted">
                    {[b.pet?.name, b.earnedAt ? fmtDate(b.earnedAt) : null, b.description].filter(Boolean).join(" · ")}
                  </Text>
                </Card>
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
