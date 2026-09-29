import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useTheme } from "@/lib/theme";
import { Text } from "@/components/ui";

/** Minimal in-screen header with back button for stacked screens (headerShown: false). */
export function BackHeader({ title, right, fallback }: { title?: string; right?: React.ReactNode; fallback?: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace((fallback ?? "/") as never);
  };
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: t.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, height: 48 }}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={10} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={26} color={t.ink} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>
          {title ?? ""}
        </Text>
        {right}
      </View>
    </View>
  );
}
