import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/** Registers the Expo push token with the API. Silently no-ops on simulators/web or when permission is denied. */
export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Padrão",
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: "#f95d16",
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (token && token !== registeredToken) {
      await api("/push-tokens", { method: "POST", json: { token, platform: Platform.OS === "ios" ? "IOS" : "ANDROID" } });
      registeredToken = token;
    }
    return token;
  } catch {
    return null;
  }
}

export async function unregisterPushToken(): Promise<void> {
  if (!registeredToken) return;
  try {
    await api("/push-tokens", { method: "DELETE", json: { token: registeredToken, platform: Platform.OS === "ios" ? "IOS" : "ANDROID" } });
  } catch {
    /* ignore */
  }
  registeredToken = null;
}

/** In-app route prefixes a push notification may navigate to. */
const ALLOWED_ROUTE_PREFIXES = ["/agenda", "/pets", "/contratos", "/inicio", "/(tutor)/", "/(parceiro)/", "/convite/"];

/**
 * Validates a route from a push payload: must be an in-app path (single leading "/", no "//", no scheme, no
 * backslashes/control chars) under one of the allowed prefixes. Returns null otherwise.
 */
export function safePushRoute(route: unknown): string | null {
  if (typeof route !== "string" || route.length > 512) return null;
  if (!route.startsWith("/") || route.includes("//") || route.includes("\\") || /[\u0000-\u001F\u007F\s]/.test(route)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(route.slice(1)) || route.includes("..")) return null;
  const ok = ALLOWED_ROUTE_PREFIXES.some((p) => (p.endsWith("/") ? route.startsWith(p) : route === p || route.startsWith(`${p}/`) || route.startsWith(`${p}?`)));
  return ok ? route : null;
}

/** Extracts a navigable (allowlisted) route from a notification payload (`data.route`). */
export function routeFromNotification(n: Notifications.Notification | null | undefined): string | null {
  const data = n?.request?.content?.data as { route?: unknown } | undefined;
  return safePushRoute(data?.route);
}
