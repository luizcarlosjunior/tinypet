import React, { useMemo, useState } from "react";
import { SectionList, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { addDays } from "@tinypet/shared";
import { useMyAppointments } from "@/hooks/use-me";
import { dayKey, fmtDayLong, todayISO } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import { Button, Empty, ErrorState, Loading, Screen, Segmented, Text } from "@/components/ui";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";

type Mode = "upcoming" | "past";

export default function TutorAgenda() {
  const t = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("upcoming");
  const range = useMemo(() => {
    const today = new Date();
    return mode === "upcoming" ? { from: todayISO(today), to: todayISO(addDays(today, 90)) } : { from: todayISO(addDays(today, -180)), to: todayISO(today) };
  }, [mode]);
  const q = useMyAppointments(range);

  const sections = useMemo(() => {
    const list = [...(q.data ?? [])].sort((a, b) => (mode === "upcoming" ? a.startsAt.localeCompare(b.startsAt) : b.startsAt.localeCompare(a.startsAt)));
    const map = new Map<string, typeof list>();
    for (const a of list) {
      const k = dayKey(a.startsAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return [...map.entries()].map(([key, data]) => ({ key, title: fmtDayLong(key), data }));
  }, [q.data, mode]);

  return (
    <Screen scroll={false} title="Agenda" right={<Button title="Agendar" size="sm" icon="add" onPress={() => router.push("/(tutor)/buscar")} />}>
      <Segmented items={[{ key: "upcoming", label: "Próximas" }, { key: "past", label: "Anteriores" }]} value={mode} onChange={setMode} />
      <View style={{ height: spacing.md }} />
      {q.isLoading ? <Loading /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
      {q.data ? (
        <SectionList
          sections={sections}
          keyExtractor={(a) => a.id}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch} tintColor={t.primary} colors={[t.primary]} />}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          renderSectionHeader={({ section }) => (
            <Text variant="small" tone="muted" style={{ fontWeight: "700", textTransform: "capitalize", marginBottom: spacing.sm, marginTop: spacing.sm }}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => <AppointmentCard a={item} side="owner" onPress={() => router.push(`/(tutor)/agenda/${item.id}`)} />}
          ListEmptyComponent={<Empty icon="calendar-outline" title={mode === "upcoming" ? "Nenhuma visita marcada" : "Nenhum atendimento anterior"} action={mode === "upcoming" ? "Encontrar parceiros" : undefined} onAction={() => router.push("/(tutor)/buscar")} />}
        />
      ) : null}
    </Screen>
  );
}
