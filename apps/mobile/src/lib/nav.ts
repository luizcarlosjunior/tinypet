import { Alert, Platform } from "react-native";
import { openLocal } from "./links";
import { mapsLinks } from "@tinypet/shared";
import type { Address } from "./types";
import { NAV_APP_KEY, getPref, setPref } from "./storage";

export type NavApp = "google" | "waze" | "apple";
export const NAV_APP_LABEL: Record<NavApp, string> = { google: "Google Maps", waze: "Waze", apple: "Apple Maps" };

export function availableNavApps(): NavApp[] {
  return Platform.OS === "ios" ? ["google", "waze", "apple"] : ["google", "waze"];
}

export function addressText(a: Address | string | null | undefined): string {
  if (!a) return "";
  if (typeof a === "string") return a;
  const parts = [`${a.street}${a.number ? `, ${a.number}` : ""}`, a.district, `${a.city} - ${a.state}`].filter(Boolean);
  return parts.join(", ");
}

export function linksFor(a: Address | { lat?: number | null; lng?: number | null; address?: Address | string | null } | null | undefined) {
  if (!a) return mapsLinks(null, null, "");
  if ("street" in a) return mapsLinks(a.latitude, a.longitude, addressText(a));
  return mapsLinks(a.lat, a.lng, addressText(a.address));
}

export async function getNavAppPref(): Promise<NavApp | null> {
  const v = await getPref(NAV_APP_KEY);
  return v === "google" || v === "waze" || v === "apple" ? v : null;
}
export async function setNavAppPref(app: NavApp | null) {
  await setPref(NAV_APP_KEY, app);
}

export async function openNav(app: NavApp, links: ReturnType<typeof mapsLinks>) {
  const url = links[app];
  if (!(await openLocal(url))) Alert.alert("Não foi possível abrir", "Nenhum aplicativo de mapas encontrado para abrir a rota.");
}

/** Opens the route in the preferred nav app, or asks which one to use. */
export async function openRoute(links: ReturnType<typeof mapsLinks>) {
  const pref = await getNavAppPref();
  if (pref) return openNav(pref, links);
  const apps = availableNavApps();
  Alert.alert("Como chegar", "Abrir a rota em:", [
    ...apps.map((a) => ({ text: NAV_APP_LABEL[a], onPress: () => openNav(a, links) })),
    { text: "Cancelar", style: "cancel" as const },
  ]);
}
