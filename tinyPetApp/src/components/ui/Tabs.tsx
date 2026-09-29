import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Text } from "./Text";

export type TabItem<K extends string = string> = { key: K; label: string };

/** Horizontal, scrollable segmented tabs. */
export function Tabs<K extends string>({ items, value, onChange }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={it.label}
            style={[styles.tab, { backgroundColor: active ? t.primary : t.surfaceAlt }]}
          >
            <Text variant="small" style={{ color: active ? t.onPrimary : t.inkMuted, fontWeight: "600" }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Compact two-to-four-way segmented control. */
export function Segmented<K extends string>({ items, value, onChange }: { items: TabItem<K>[]; value: K | null; onChange: (k: K) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: t.surfaceAlt }]} accessibilityRole="tablist">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.segItem, active && { backgroundColor: t.surface }]}>
            <Text variant="small" style={{ fontWeight: "600", color: active ? t.ink : t.inkMuted }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  seg: { flexDirection: "row", padding: 3, borderRadius: radius.md },
  segItem: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radius.sm },
});
