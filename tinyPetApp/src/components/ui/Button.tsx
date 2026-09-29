import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  full?: boolean;
};

export function Button({ title, onPress, variant = "primary", size = "md", loading, disabled, icon, style, accessibilityLabel, full }: ButtonProps) {
  const t = useTheme();
  const bg: Record<Variant, string> = { primary: t.primary, secondary: t.surfaceAlt, ghost: "transparent", danger: t.danger, outline: "transparent" };
  const fg: Record<Variant, string> = { primary: t.onPrimary, secondary: t.ink, ghost: t.primary, danger: "#fff", outline: t.ink };
  const height = size === "sm" ? 36 : size === "lg" ? 52 : 44;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { height, backgroundColor: bg[variant], opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1, borderColor: variant === "outline" ? t.border : "transparent", borderWidth: variant === "outline" ? 1 : 0, alignSelf: full ? "stretch" : undefined },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === "sm" ? 16 : 18} color={fg[variant]} style={{ marginRight: 6 }} /> : null}
          <Text variant={size === "sm" ? "small" : "h3"} style={{ color: fg[variant], fontWeight: "600" }}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.md },
});
