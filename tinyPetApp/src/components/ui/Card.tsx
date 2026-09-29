import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, spacing, useTheme } from "@/lib/theme";

export function Card({ children, style, onPress, accessibilityLabel }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const t = useTheme();
  const s = [styles.card, { backgroundColor: t.surface, borderColor: t.border }, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...s, { opacity: pressed ? 0.85 : 1 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={s}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
});
