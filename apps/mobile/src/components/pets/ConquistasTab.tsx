import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { SYSTEM_BADGES } from "@tinypet/shared";
import { useBadges } from "@/hooks/use-pets";
import { fmtDate } from "@/lib/format";
import { radius, spacing, useTheme } from "@/lib/theme";
import { ErrorState, Loading, Text } from "@/components/ui";

/** Conquistas: earned badges + locked system badges. */
export function ConquistasTab({ petId }: { petId: string }) {
  const t = useTheme();
  const q = useBadges(petId);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const earned = q.data ?? [];
  const earnedKeys = new Set(earned.map((b) => b.key));
  const locked = SYSTEM_BADGES.filter((b) => !earnedKeys.has(b.key));
  return (
    <View>
      <Text variant="small" tone="muted" style={{ marginBottom: spacing.md }}>
        {earned.length} de {earned.length + locked.length} conquistas
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        {earned.map((b) => (
          <View key={b.key} style={{ width: "47%", backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: t.primary, padding: spacing.md, alignItems: "center" }} accessibilityLabel={`${b.name}, conquistada`}>
            {b.iconUrl ? <Image source={{ uri: b.iconUrl }} style={{ width: 44, height: 44 }} contentFit="contain" /> : <Ionicons name="trophy" size={40} color={t.primary} />}
            <Text variant="h3" style={{ marginTop: 6, textAlign: "center" }}>
              {b.name}
            </Text>
            <Text variant="tiny" tone="muted" style={{ textAlign: "center" }}>
              {b.description ?? ""}
            </Text>
            <Text variant="tiny" tone="primary" style={{ marginTop: 4 }}>
              {b.earnedAt ? fmtDate(b.earnedAt) : ""}
              {b.partner ? ` · ${b.partner.tradeName}` : ""}
            </Text>
          </View>
        ))}
        {locked.map((b) => (
          <View key={b.key} style={{ width: "47%", backgroundColor: t.surfaceAlt, borderRadius: radius.lg, padding: spacing.md, alignItems: "center", opacity: 0.7 }} accessibilityLabel={`${b.name}, bloqueada`}>
            <Ionicons name="lock-closed" size={36} color={t.inkFaint} />
            <Text variant="h3" style={{ marginTop: 6, textAlign: "center" }}>
              {b.name}
            </Text>
            <Text variant="tiny" tone="muted" style={{ textAlign: "center" }}>
              {b.description}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
