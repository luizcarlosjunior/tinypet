import React from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "@/lib/theme";
import { Text } from "./Text";

export function Section({ title, right, children, style }: { title: string; right?: React.ReactNode; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.head}>
        <Text variant="h2" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, gap = spacing.sm, style }: { children: React.ReactNode; gap?: number; style?: object }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

export function KeyValue({ k, v }: { k: string; v?: string | number | null }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <View style={styles.kv}>
      <Text variant="small" tone="muted" style={{ width: 130 }}>
        {k}
      </Text>
      <Text variant="small" style={{ flex: 1 }}>
        {String(v)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  head: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.sm },
  kv: { flexDirection: "row", paddingVertical: 4 },
});
