import React, { useMemo, useState } from "react";
import { SectionList, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { addDays } from "@tinypet/shared";
import { useAuth } from "@/lib/auth-store";
import { useScheduleAppointments } from "@/hooks/use-partner";
import { dayKey, fmtDate, fmtDayLong, todayISO } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { Appointment } from "@/lib/types";
import { Button, Empty, ErrorState, Loading, Screen, Segmented, Text } from "@/components/ui";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";

type View_ = "day" | "list";
type LocFilter = "ALL" | Appointment["locationType"];

export default function PartnerAgenda() {
  const t = useTheme();
  const router = useRouter();
  const { activePartnerId, activeMembership } = useAuth();
  const [view, setView] = useState<View_>("day");
  const [day, setDay] = useState(todayISO());
  const [loc, setLoc] = useState<LocFilter>("ALL");
  const range = useMemo(() => (view === "day" ? { from: day, to: day } : { from: todayISO(), to: todayISO(addDays(new Date(), 30)) }), [view, day]);
  const q = useScheduleAppointments({ ...range, locationType: loc === "ALL" ? undefined : loc }, activePartnerId);

  const sections = useMemo(() => {
    const list = [...(q.data ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const map = new Map<string, Appointment[]>();
    for (const a of list) {
      const k = dayKey(a.startsAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return [...map.entries()].map(([key, data]) => ({ key, title: fmtDayLong(key), data }));
  }, [q.data]);
  const homeVisitsToday = view === "day" && (q.data ?? []).some((a) => a.locationType === "CLIENT_HOME" && a.status !== "CANCELED");

  return (
    <Screen scroll={false} title="Agenda" subtitle={activeMembership?.partnerName} right={homeVisitsToday ? <Button title="Rota do dia" size="sm" icon="map-outline" onPress={() => router.push(`/(parceiro)/agenda/rota?date=${day}`)} /> : undefined}>
      <Segmented items={[{ key: "day", label: "Dia" }, { key: "list", label: "Próximos 30 dias" }]} value={view} onChange={setView} />
      {view === "day" ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }}>
          <Button title="Anterior" size="sm" variant="ghost" icon="chevron-back" onPress={() => setDay(todayISO(addDays(new Date(day + "T12:00:00"), -1)))} accessibilityLabel="Dia anterior" />
          <Text variant="h3" style={{ textTransform: "capitalize" }} onPress={() => setDay(todayISO())}>
            {fmtDayLong(day)} · {fmtDate(day, "dd/MM")}
          </Text>
          <Button title="Próximo" size="sm" variant="ghost" icon="chevron-forward" onPress={() => setDay(todayISO(addDays(new Date(day + "T12:00:00"), 1)))} accessibilityLabel="Próximo dia" />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 6, marginVertical: spacing.sm, flexWrap: "wrap" }}>
        {([["ALL", "Todos"], ["CLIENT_HOME", "A domicílio"], ["PARTNER_VENUE", "No local"], ["ONLINE", "Online"]] as [LocFilter, string][]).map(([k, label]) => (
          <Button key={k} title={label} size="sm" variant={loc === k ? "primary" : "outline"} onPress={() => setLoc(k)} />
        ))}
      </View>
      {q.isLoading ? <Loading /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
      {q.data ? (
        <SectionList
          sections={sections}
          keyExtractor={(a) => a.id}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch} tintColor={t.primary} colors={[t.primary]} />}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          renderSectionHeader={({ section }) => (view === "list" ? <Text variant="small" tone="muted" style={{ fontWeight: "700", textTransform: "capitalize", marginVertical: spacing.sm }}>{section.title}</Text> : null)}
          renderItem={({ item }) => <AppointmentCard a={item} side="partner" onPress={() => router.push(`/(parceiro)/agenda/${item.id}`)} />}
          ListEmptyComponent={<Empty icon="calendar-outline" title="Nenhum atendimento" description={view === "day" ? "Nada marcado para este dia." : "Nada marcado nos próximos 30 dias."} />}
        />
      ) : null}
    </Screen>
  );
}
