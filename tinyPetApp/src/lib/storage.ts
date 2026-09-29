import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const TOKEN_KEY = "tinypet.token";
export const PARTNER_KEY = "tinypet.partnerId";
export const NAV_APP_KEY = "tinypet.navApp";

// SecureStore is unavailable on web; fall back to AsyncStorage there so the web smoke build works.
const secureAvailable = Platform.OS !== "web";

export async function getToken(): Promise<string | null> {
  try {
    return secureAvailable ? await SecureStore.getItemAsync(TOKEN_KEY) : await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export async function setToken(token: string | null): Promise<void> {
  try {
    if (secureAvailable) {
      if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    } else if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function getPref(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}
export async function setPref(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
