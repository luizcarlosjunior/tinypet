import React from "react";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-store";
import { useTheme } from "@/lib/theme";

export default function PartnerLayout() {
  const t = useTheme();
  const { ready, activePartnerId } = useAuth();
  if (ready && !activePartnerId) return <Redirect href="/(tutor)/inicio" />;
  const icon = (name: keyof typeof Ionicons.glyphMap, active: keyof typeof Ionicons.glyphMap) =>
    ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? active : name} size={22} color={color} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.inkFaint,
        tabBarStyle: { backgroundColor: t.tabBar, borderTopColor: t.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="agenda" options={{ title: "Agenda", tabBarIcon: icon("calendar-outline", "calendar"), tabBarAccessibilityLabel: "Agenda" }} />
      <Tabs.Screen name="clientes" options={{ title: "Clientes", tabBarIcon: icon("people-outline", "people"), tabBarAccessibilityLabel: "Clientes" }} />
      <Tabs.Screen name="mais" options={{ title: "Mais", tabBarIcon: icon("menu-outline", "menu"), tabBarAccessibilityLabel: "Mais opções" }} />
    </Tabs>
  );
}
