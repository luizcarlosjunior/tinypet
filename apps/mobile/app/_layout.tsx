import "react-native-gesture-handler";
import React, { useEffect, useRef } from "react";
import { Platform, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-store";
import { queryClient } from "@/lib/query";
import { registerPushToken, routeFromNotification, safePushRoute } from "@/lib/push";
import { brand, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function useProtectedRoutes() {
  const { ready, token, activePartnerId } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    const group = segments[0] as string | undefined;
    const inAuth = group === "(auth)";
    const isPublic = group === "convite"; // invite preview is public; accepting asks for login
    if (!token && !inAuth && !isPublic) {
      router.replace("/(auth)/entrar");
    } else if (token && (inAuth || group === undefined)) {
      router.replace(activePartnerId ? "/(parceiro)/agenda" : "/(tutor)/inicio");
    }
  }, [ready, token, segments, router, activePartnerId]);
}

function usePushNavigation() {
  const { token } = useAuth();
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    registerPushToken();
  }, [token]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const navigate = (route: string | null) => {
      const safe = safePushRoute(route);
      if (!safe || handled.current === safe) return;
      route = safe;
      handled.current = route;
      router.push(route as never);
    };
    Notifications.getLastNotificationResponseAsync().then((r) => navigate(routeFromNotification(r?.notification)));
    const sub = Notifications.addNotificationResponseReceivedListener((r) => navigate(routeFromNotification(r.notification)));
    return () => sub.remove();
  }, [router]);
}

function RootNavigator() {
  useProtectedRoutes();
  usePushNavigation();
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tutor)" />
      <Stack.Screen name="(parceiro)" />
      <Stack.Screen name="convite/[token]" options={{ headerShown: true, title: "Convite", headerTintColor: t.ink, headerStyle: { backgroundColor: t.surface } }} />
      <Stack.Screen name="+not-found" options={{ headerShown: true, title: "Página não encontrada" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const navTheme = scheme === "dark" ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: brand.orange, background: "#0f0f11", card: "#1b1b1f" } } : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: brand.orange, background: "#f7f7f8", card: "#ffffff" } };
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider value={navTheme}>
              <StatusBar style={scheme === "dark" ? "light" : "dark"} />
              <RootNavigator />
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
