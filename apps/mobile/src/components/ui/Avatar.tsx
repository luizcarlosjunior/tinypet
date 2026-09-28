import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Text } from "./Text";

const speciesIcon: Record<string, keyof typeof Ionicons.glyphMap> = { dog: "paw", cat: "paw", bird: "leaf", fish: "water", turtle: "leaf", rodent: "paw", reptile: "leaf", other: "paw" };

export function Avatar({ uri, name, size = 48, species, square }: { uri?: string | null; name?: string; size?: number; species?: string | null; square?: boolean }) {
  const t = useTheme();
  const r = square ? 12 : size / 2;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r, backgroundColor: t.surfaceAlt }} contentFit="cover" accessibilityLabel={name ? `Foto de ${name}` : "Foto"} transition={150} />;
  }
  const initials = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" }} accessibilityLabel={name}>
      {species ? <Ionicons name={speciesIcon[species] ?? "paw"} size={size * 0.45} color={t.primary} /> : <Text style={{ color: t.primary, fontWeight: "700", fontSize: size * 0.38 }}>{initials || "?"}</Text>}
    </View>
  );
}
