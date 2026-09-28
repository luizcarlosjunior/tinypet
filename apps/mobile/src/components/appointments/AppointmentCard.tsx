import React from "react";
import { Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { APPOINTMENT_STATUS_LABEL, LOCATION_TYPE_LABEL } from "@tinypet/shared";
import { fmtTime, fmtDate } from "@/lib/format";
import { addressText, linksFor, openNav, openRoute, type NavApp } from "@/lib/nav";
import { spacing, useTheme } from "@/lib/theme";
import type { Address, Appointment } from "@/lib/types";
import { Badge, Button, Card, Text, type BadgeTone } from "@/components/ui";
import { statusTone } from "@/components/ui/Badge";

const LOC_TONE: Record<Appointment["locationType"], BadgeTone> = { CLIENT_HOME: "primary", PARTNER_VENUE: "info", OTHER: "neutral", ONLINE: "success" };
const LOC_ICON: Record<Appointment["locationType"], keyof typeof Ionicons.glyphMap> = { CLIENT_HOME: "home", PARTNER_VENUE: "storefront", OTHER: "location", ONLINE: "videocam" };

export function LocationBadge({ type }: { type: Appointment["locationType"] }) {
  return <Badge label={LOCATION_TYPE_LABEL[type] ?? type} tone={LOC_TONE[type] ?? "neutral"} icon={LOC_ICON[type] ?? "location"} />;
}

/** "Como chegar" buttons: Google Maps / Waze (+ Apple Maps on iOS), plus one-tap route with the stored preference. */
export function MapsButtons({ address, compact }: { address: Address | string | null | undefined; compact?: boolean }) {
  if (!address) return null;
  const links = linksFor(typeof address === "string" ? { address } : address);
  const apps: NavApp[] = Platform.OS === "ios" ? ["google", "waze", "apple"] : ["google", "waze"];
  const labels: Record<NavApp, string> = { google: "Google Maps", waze: "Waze", apple: "Apple Maps" };
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
      {compact ? (
        <Button title="Como chegar" size="sm" icon="navigate" onPress={() => openRoute(links)} accessibilityLabel="Como chegar" />
      ) : (
        apps.map((a) => <Button key={a} title={labels[a]} size="sm" variant="outline" icon="navigate-outline" onPress={() => openNav(a, links)} accessibilityLabel={`Abrir rota no ${labels[a]}`} />)
      )}
    </View>
  );
}

/** Address + access instructions block shown next to the maps buttons. */
export function AddressBlock({ address, notes }: { address: Address | null | undefined; notes?: string | null }) {
  const t = useTheme();
  if (!address && !notes) return null;
  return (
    <View style={{ marginTop: spacing.sm }}>
      {address ? <Text variant="small">{addressText(address)}</Text> : null}
      {address?.complement ? (
        <Text variant="small" tone="muted">
          {address.complement}
        </Text>
      ) : null}
      {address?.reference ? (
        <Text variant="small" tone="muted">
          Referência: {address.reference}
        </Text>
      ) : null}
      {address?.accessNotes ? (
        <View style={{ flexDirection: "row", gap: 4, alignItems: "center", marginTop: 2 }}>
          <Ionicons name="key-outline" size={12} color={t.inkMuted} />
          <Text variant="small" tone="muted">
            {address.accessNotes}
          </Text>
        </View>
      ) : null}
      {notes ? (
        <Text variant="small" tone="muted">
          {notes}
        </Text>
      ) : null}
    </View>
  );
}

export function AppointmentCard({ a, onPress, side, showDate }: { a: Appointment; onPress?: () => void; side: "owner" | "partner"; showDate?: boolean }) {
  const t = useTheme();
  const petNames = (a.pets ?? []).map((p) => p.name).join(", ");
  const who = side === "owner" ? a.partner?.tradeName : a.client?.name;
  const alert = a.travelLeg?.alert;
  const showMaps = side === "owner" ? a.locationType === "PARTNER_VENUE" || a.locationType === "OTHER" : a.locationType === "CLIENT_HOME" || a.locationType === "OTHER";
  return (
    <Card onPress={onPress} accessibilityLabel={`${a.item?.name ?? a.title ?? "Atendimento"} ${fmtTime(a.startsAt)}`} style={alert ? { borderColor: t.warning } : undefined}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        <View style={{ alignItems: "center", minWidth: 52 }}>
          <Text variant="h2">{fmtTime(a.startsAt)}</Text>
          {showDate ? (
            <Text variant="tiny" tone="muted">
              {fmtDate(a.startsAt, "dd/MM")}
            </Text>
          ) : null}
          <Text variant="tiny" tone="faint">
            {a.durationMinutes} min
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3" numberOfLines={1}>
            {a.item?.name ?? a.title ?? "Atendimento"}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {[petNames, who].filter(Boolean).join(" · ")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            <LocationBadge type={a.locationType} />
            <Badge label={APPOINTMENT_STATUS_LABEL[a.status] ?? a.status} tone={statusTone(a.status)} />
            {side === "partner" && a.membership ? <Badge label={a.membership.user?.name ?? a.membership.name ?? "Profissional"} icon="person" /> : null}
          </View>
          {a.travelLeg && side === "partner" && a.locationType === "CLIENT_HOME" ? (
            <Text variant="tiny" tone={alert ? "danger" : "faint"} style={{ marginTop: 4 }}>
              {a.travelLeg.distanceKm != null ? `${a.travelLeg.distanceKm.toFixed(1)} km · ` : ""}
              {a.travelLeg.minutes != null ? `${Math.round(a.travelLeg.minutes)} min de deslocamento` : ""}
              {a.travelLeg.estimated ? " (estimativa)" : ""}
              {alert ? ` · ${alert}` : ""}
            </Text>
          ) : null}
          {showMaps && a.status !== "CANCELED" && a.status !== "COMPLETED" ? <MapsButtons address={a.address ?? null} compact /> : null}
        </View>
      </View>
    </Card>
  );
}
