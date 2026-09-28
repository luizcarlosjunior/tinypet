import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, useTheme } from "@/lib/theme";
import { Text } from "./Text";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export function Badge({ label, tone = "neutral", icon }: { label: string; tone?: BadgeTone; icon?: keyof typeof Ionicons.glyphMap }) {
  const t = useTheme();
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: t.surfaceAlt, fg: t.inkMuted },
    primary: { bg: t.primarySoft, fg: t.primary },
    success: { bg: t.successSoft, fg: t.success },
    warning: { bg: t.warningSoft, fg: t.warning },
    danger: { bg: t.dangerSoft, fg: t.danger },
    info: { bg: t.infoSoft, fg: t.info },
  };
  const c = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]} accessibilityLabel={label}>
      {icon ? <Ionicons name={icon} size={12} color={c.fg} style={{ marginRight: 4 }} /> : null}
      <Text variant="tiny" style={{ color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "CONFIRMED":
    case "ACTIVE":
    case "PAID":
    case "COMPLETED":
      return status === "COMPLETED" ? "info" : "success";
    case "REQUESTED":
    case "PENDING":
    case "PROPOSED":
    case "DRAFT":
      return "warning";
    case "IN_PROGRESS":
      return "primary";
    case "CANCELED":
    case "OVERDUE":
    case "NO_SHOW":
      return "danger";
    default:
      return "neutral";
  }
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, alignSelf: "flex-start" },
});
