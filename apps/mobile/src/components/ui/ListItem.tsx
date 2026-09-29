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
  const content = (
    <>
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
    </>
  );
  // Non-pressable rows stay a plain View: an accessible (labelled) wrapper would swallow the `right` controls
  // (e.g. "Remover", "Aceitar") so VoiceOver/TalkBack — and UI automation — could not reach them.
  if (!onPress) return <View style={[styles.row, { borderBottomColor: t.border }]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={({ pressed }) => [styles.row, { borderBottomColor: t.border, opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
