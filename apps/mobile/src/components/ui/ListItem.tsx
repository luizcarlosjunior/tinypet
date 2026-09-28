import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, useTheme } from "@/lib/theme";
import { Text } from "./Text";

export function ListItem({
  title,
  subtitle,
  left,
  right,
  onPress,
  chevron = !!onPress,
  accessibilityLabel,
  danger,
}: {
  title: string;
  subtitle?: string | null;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  accessibilityLabel?: string;
  danger?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [styles.row, { borderBottomColor: t.border, opacity: pressed ? 0.7 : 1 }]}
    >
      {left ? <View style={{ marginRight: spacing.md }}>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" style={{ fontWeight: "600", color: danger ? t.danger : t.ink }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={t.inkFaint} style={{ marginLeft: 6 }} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
