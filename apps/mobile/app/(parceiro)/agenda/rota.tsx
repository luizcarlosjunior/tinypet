import React, { useEffect, useState } from "react";
import { Alert, Linking, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mapsLinks } from "@tinypet/shared";
import { useAuth } from "@/lib/auth-store";
import { useDayRoute } from "@/hooks/use-partner";
import { fmtDate, fmtKm, fmtMinutes, fmtTime, todayISO } from "@/lib/format";
import { addressText, availableNavApps, getNavAppPref, NAV_APP_LABEL, openNav, setNavAppPref, type NavApp } from "@/lib/nav";
import { spacing, useTheme } from "@/lib/theme";
import { Badge, Button, Card, Empty, ErrorState, Loading, Screen, Text } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";

export default function DayRouteScreen() {
  const t = useTheme();
  const router = useRouter();
  const { activePartnerId, activeMembership } = useAuth();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const day = date ?? todayISO();
  const q = useDayRoute(day, activeMembership?.membershipId, activePartnerId);
  const [pref, setPref] = useState<NavApp | null>(null);
  useEffect(() => {
    getNavAppPref().then(setPref);
  }, []);
  const choosePref = async (app: NavApp | null) => {
    await setNavAppPref(app);
    setPref(app);
  };
  const r = q.data;

  const openFullRoute = () => {
    if (r?.googleMapsUrl) return Linking.openURL(r.googleMapsUrl).catch(() => Alert.alert("Não foi possível abrir o Google Maps"));
    // Fallback: build a Google Maps directions URL with waypoints from the stops.
    const pts = (r?.stops ?? []).map((s) => (s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : encodeURIComponent(addressText(s.address))));
    if (pts.length === 0) return;
    const dest = pts[pts.length - 1];
    const way = pts.slice(0, -1).join("|");
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}${way ? `&waypoints=${way}` : ""}&travelmode=driving`);
  };

  return (
    <>
      <BackHeader title={`Rota do dia · ${fmtDate(day, "dd/MM")}`} fallback="/(parceiro)/agenda" />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading label="Calculando rota…" /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {r ? (
          <>
            <Card style={{ backgroundColor: t.primarySoft, borderColor: t.primary }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text variant="tiny" tone="muted">
                    Total do dia
                  </Text>
                  <Text variant="h2">
                    {fmtKm(r.totalKm)} · {fmtMinutes(r.totalMinutes)}
                  </Text>
                </View>
                <Ionicons name="car-outline" size={32} color={t.primary} />
              </View>
              <Button title="Abrir no Google Maps" icon="map" style={{ marginTop: spacing.md }} onPress={openFullRoute} disabled={r.stops.length === 0} />
            </Card>

            <Card>
              <Text variant="h3">App de navegação padrão</Text>
              <Text variant="tiny" tone="muted" style={{ marginBottom: spacing.sm }}>
                Abre a rota com um toque nos cards da agenda.
              </Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Button title="Perguntar" size="sm" variant={pref === null ? "primary" : "outline"} onPress={() => choosePref(null)} />
                {availableNavApps().map((a) => (
                  <Button key={a} title={NAV_APP_LABEL[a]} size="sm" variant={pref === a ? "primary" : "outline"} onPress={() => choosePref(a)} />
                ))}
              </View>
            </Card>

            {r.suggestions?.length ? (
              <Card style={{ borderColor: t.info }}>
                <Text variant="h3">Sugestões</Text>
                {r.suggestions.map((s, i) => (
                  <Text key={i} variant="small" tone="muted" style={{ marginTop: 4 }}>
                    • {s.message}
                    {s.savesKm || s.savesMinutes ? ` (economiza ${[s.savesKm ? fmtKm(s.savesKm) : null, s.savesMinutes ? fmtMinutes(s.savesMinutes) : null].filter(Boolean).join(" e ")})` : ""}
                  </Text>
                ))}
                <Text variant="tiny" tone="faint" style={{ marginTop: 6 }}>
                  Aplicar sugestões é sempre decisão sua; mudanças de horário precisam do aceite do tutor.
                </Text>
              </Card>
            ) : null}

            {r.stops.length === 0 ? <Empty icon="map-outline" title="Sem visitas a domicílio" description="Nenhuma parada para este dia." /> : null}
            {r.stops.map((s) => {
              const links = mapsLinks(s.lat, s.lng, addressText(s.address));
              return (
                <Card key={s.appointmentId} onPress={() => router.push(`/(parceiro)/agenda/${s.appointmentId}`)} style={s.alert ? { borderColor: t.warning } : undefined} accessibilityLabel={`Parada ${s.order}`}>
                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.primary, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: t.onPrimary, fontWeight: "700" }}>{s.order}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="h3">
                        {fmtTime(s.startsAt)}
                        {s.clientName ? ` · ${s.clientName}` : ""}
                      </Text>
                      {s.petNames?.length ? (
                        <Text variant="small" tone="muted">
                          {s.petNames.join(", ")}
                        </Text>
                      ) : null}
                      <Text variant="small">{addressText(s.address)}</Text>
                      <Text variant="tiny" tone={s.alert ? "danger" : "faint"} style={{ marginTop: 2 }}>
                        {s.legDistanceKm != null ? `${fmtKm(s.legDistanceKm)} · ` : ""}
                        {s.legMinutes != null ? `${fmtMinutes(s.legMinutes)} desde a parada anterior` : ""}
                        {s.estimated ? " (estimativa)" : ""}
                      </Text>
                      {s.alert ? <Badge label={s.alert} tone="warning" icon="warning" /> : null}
                      <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.sm, flexWrap: "wrap" }}>
                        {availableNavApps().map((a) => (
                          <Button key={a} title={NAV_APP_LABEL[a]} size="sm" variant="outline" icon="navigate-outline" onPress={() => openNav(a, links)} accessibilityLabel={`Abrir parada ${s.order} no ${NAV_APP_LABEL[a]}`} />
                        ))}
                      </View>
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}
      </Screen>
    </>
  );
}
