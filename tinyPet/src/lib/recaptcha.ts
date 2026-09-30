"use client";
/**
 * reCAPTCHA v3 on the web: the script is loaded on demand (login/sign-up pages only) and `captchaToken(action)`
 * returns a fresh token, or null when reCAPTCHA isn't configured (NEXT_PUBLIC_RECAPTCHA_SITE_KEY empty) or fails to load.
 */
type Grecaptcha = { ready: (cb: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> };
declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";
let loading: Promise<Grecaptcha | null> | null = null;

export function loadRecaptcha(): Promise<Grecaptcha | null> {
  if (!RECAPTCHA_SITE_KEY || typeof window === "undefined") return Promise.resolve(null);
  if (window.grecaptcha) return Promise.resolve(window.grecaptcha);
  loading ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
    s.async = true;
    s.onload = () => (window.grecaptcha ? window.grecaptcha.ready(() => resolve(window.grecaptcha!)) : resolve(null));
    s.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return loading;
}

export async function captchaToken(action: string): Promise<string | null> {
  const g = await loadRecaptcha();
  if (!g) return null;
  try {
    return await g.execute(RECAPTCHA_SITE_KEY, { action });
  } catch {
    return null;
  }
}

/** Google requires this notice when the reCAPTCHA badge is hidden or small. */
export const RECAPTCHA_NOTICE = "Protegido pelo reCAPTCHA do Google (Política de Privacidade e Termos de Serviço do Google).";
