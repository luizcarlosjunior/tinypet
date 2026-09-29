import { Alert, Linking } from "react-native";

/** Schemes the app may hand to the OS. http(s) for web content; the rest only for URLs we build locally. */
const WEB_SCHEMES = new Set(["https:", "http:"]);
const LOCAL_SCHEMES = new Set(["tel:", "mailto:", "sms:", "geo:", "maps:", "comgooglemaps:", "waze:"]);

function protocolOf(url: string): string | null {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim());
  return m ? `${m[1]!.toLowerCase()}:` : null;
}

/** True only for absolute http(s) URLs without whitespace/control chars. */
export function isWebUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url || url.length > 2048 || /[\u0000-\u001F\u007F\s]/.test(url)) return false;
  const p = protocolOf(url);
  return !!p && WEB_SCHEMES.has(p) && /^https?:\/\/[^/?#]+/i.test(url);
}

/**
 * Opens a user/partner-provided URL in the OS — only http(s). Anything else (javascript:, intent:, file:, custom app
 * schemes…) is refused.
 */
export async function openExternal(url: string | null | undefined): Promise<boolean> {
  if (!isWebUrl(url)) {
    Alert.alert("Link inválido", "Não foi possível abrir este link.");
    return false;
  }
  try {
    await Linking.openURL(url.trim());
    return true;
  } catch {
    Alert.alert("Não foi possível abrir o link");
    return false;
  }
}

/**
 * Opens a URL the app built itself (tel:, mailto:, sms:, maps). Still refuses unknown schemes.
 * Never pass raw user/partner-provided URLs here — use `openExternal`. Fails silently (returns false).
 */
export async function openLocal(url: string): Promise<boolean> {
  const p = protocolOf(url);
  if (!p || (!WEB_SCHEMES.has(p) && !LOCAL_SCHEMES.has(p))) return false;
  if (WEB_SCHEMES.has(p) && !isWebUrl(url)) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Builds a tel: link from a phone number (digits and a leading + only). */
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
/** Builds a WhatsApp link from a phone number. */
export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
/** Builds a mailto: link, rejecting anything that isn't a plain address. */
export function mailtoUrl(address: string): string | null {
  const a = address.trim();
  return /^[^\s@<>()"',;:\\]+@[^\s@<>()"',;:\\]+$/.test(a) ? `mailto:${a}` : null;
}
