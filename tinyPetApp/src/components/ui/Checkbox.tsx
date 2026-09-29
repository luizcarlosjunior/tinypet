import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, useTheme } from "@/lib/theme";
import { Text } from "./Text";

export function Checkbox({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[styles.row, { opacity: disabled ? 0.6 : 1 }]}
    >
      <View style={[styles.box, { borderColor: checked ? t.primary : t.border, backgroundColor: checked ? t.primary : "transparent" }]}>{checked ? <Ionicons name="checkmark" size={16} color={t.onPrimary} /> : null}</View>
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
        {description ? (
          <Text variant="small" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
