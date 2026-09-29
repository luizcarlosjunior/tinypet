import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Text } from "@/components/ui";

/** Toggle "heart" (this deserves a heart). Accessible as a toggle button with checked state. */
export function HeartButton({ hearted, count, onPress, label, size = "md", disabled }: { hearted: boolean; count: number; onPress: () => void; label: string; size?: "sm" | "md"; disabled?: boolean }) {
  const t = useTheme();
  const sm = size === "sm";
  const countLabel = `${count} ${count === 1 ? "coração" : "corações"}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="togglebutton"
      accessibilityLabel={`${label}, ${countLabel}`}
      accessibilityHint={hearted ? "Toque para retirar o coração" : "Toque para dar um coração"}
      accessibilityState={{ checked: hearted, disabled }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: sm ? 6 : spacing.md,
        height: sm ? 28 : 40,
        borderRadius: radius.full,
        backgroundColor: sm ? "transparent" : hearted ? t.primarySoft : t.surfaceAlt,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View>
        <Ionicons name={hearted ? "heart" : "heart-outline"} size={sm ? 16 : 20} color={hearted ? t.primary : t.inkMuted} />
      </View>
      <Text variant={sm ? "tiny" : "small"} style={{ fontWeight: "600", color: hearted ? t.primary : t.inkMuted }}>
        {count}
      </Text>
    </Pressable>
  );
}
