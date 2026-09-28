import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

export default function TutorLayout() {
  const t = useTheme();
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
      <Tabs.Screen name="inicio" options={{ title: "Início", tabBarIcon: icon("home-outline", "home"), tabBarAccessibilityLabel: "Início" }} />
      <Tabs.Screen name="pets" options={{ title: "Pets", tabBarIcon: icon("paw-outline", "paw"), tabBarAccessibilityLabel: "Meus pets" }} />
      <Tabs.Screen name="agenda" options={{ title: "Agenda", tabBarIcon: icon("calendar-outline", "calendar"), tabBarAccessibilityLabel: "Agenda" }} />
      <Tabs.Screen name="contratos" options={{ title: "Contratos", tabBarIcon: icon("document-text-outline", "document-text"), tabBarAccessibilityLabel: "Contratos" }} />
      <Tabs.Screen name="conta" options={{ title: "Conta", tabBarIcon: icon("person-circle-outline", "person-circle"), tabBarAccessibilityLabel: "Conta" }} />
      {/* Non-tab routes (reachable by navigation and deep links) */}
      <Tabs.Screen name="buscar" options={{ href: null }} />
      <Tabs.Screen name="p/[slug]" options={{ href: null }} />
      <Tabs.Screen name="item/[id]" options={{ href: null }} />
      <Tabs.Screen name="agendar/[partnerSlug]/[itemId]" options={{ href: null }} />
    </Tabs>
  );
}
