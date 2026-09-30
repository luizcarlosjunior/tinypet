import { ApiError } from "./errors";

/**
 * Google reCAPTCHA v3 (invisible, score based). Enabled when RECAPTCHA_SECRET_KEY is set; the web gets the site key
 * from NEXT_PUBLIC_RECAPTCHA_SITE_KEY. The token travels in the `X-Captcha-Token` header (or a `captchaToken` field).
 *
 * Policy (see auth routes): the web always sends a token; requests without one (the mobile app can't run reCAPTCHA)
 * are accepted until a risk signal appears (repeated failed logins for an e-mail/IP, many sign-ups from one IP) —
 * then a valid token is required (400 CAPTCHA_REQUIRED). A token that is sent is always verified.
 */
const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export const captchaEnabled = () => !!process.env.RECAPTCHA_SECRET_KEY;
const minScore = () => {
  const n = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : 0.5;
};

export const captchaRequiredError = () => new ApiError(400, "CAPTCHA_REQUIRED", "Confirme que você não é um robô para continuar.");
const captchaFailedError = () => new ApiError(400, "CAPTCHA_FAILED", "Não foi possível confirmar que você não é um robô. Tente novamente.");

export type CaptchaResult = { success: boolean; score?: number; action?: string; hostname?: string; "error-codes"?: string[] };

/** Verifies a token with Google. Throws CAPTCHA_FAILED on invalid token, wrong action or low score. */
export async function verifyCaptcha(token: string, action: string, ip?: string | null): Promise<void> {
  const body = new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET_KEY ?? "", response: token });
  if (ip && ip !== "0.0.0.0") body.set("remoteip", ip);
  let r: CaptchaResult;
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000), cache: "no-store" });
    r = (await res.json()) as CaptchaResult;
  } catch {
    // Google unreachable: fail closed (the request is a risky one — a token was required or provided).
    throw new ApiError(503, "CAPTCHA_UNAVAILABLE", "Verificação anti-robô indisponível. Tente novamente em instantes.");
  }
  if (!r.success || (r.action && r.action !== action) || (typeof r.score === "number" && r.score < minScore())) throw captchaFailedError();
}

/** Reads the token from the header or a body field. */
export function captchaTokenFrom(req: Request, bodyToken?: unknown): string | null {
  const h = req.headers.get("x-captcha-token");
  const t = h ?? (typeof bodyToken === "string" ? bodyToken : null);
  return t && t.length <= 4096 ? t : null;
}

/**
 * Adaptive check: verifies the token when present; when absent, throws CAPTCHA_REQUIRED only if `required`
 * (risk signal). No-op while reCAPTCHA isn't configured.
 */
export async function checkCaptcha(token: string | null, action: string, ip: string | null, required: boolean) {
  if (!captchaEnabled()) return;
  if (token) return verifyCaptcha(token, action, ip);
  if (required) throw captchaRequiredError();
}
