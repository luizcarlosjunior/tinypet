"use client";
import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";

/** Google/Apple buttons, shown only when those providers are configured. */
export function SocialButtons({ callbackUrl }: { callbackUrl: string }) {
  const [providers, setProviders] = useState<string[]>([]);
  useEffect(() => {
    getProviders()
      .then((p) => setProviders(Object.keys(p ?? {}).filter((k) => k !== "credentials")))
      .catch(() => setProviders([]));
  }, []);
  if (!providers.length) return null;
  return (
    <div className="space-y-2">
      <div className="relative my-4 text-center text-xs text-[var(--muted)]">
        <span className="relative z-10 bg-[var(--bg)] px-2">ou continue com</span>
        <span className="absolute left-0 top-1/2 -z-0 h-px w-full bg-[var(--border)]" aria-hidden />
      </div>
      {providers.includes("google") && (
        <button type="button" onClick={() => signIn("google", { callbackUrl })} className="btn-secondary w-full">
          Google
        </button>
      )}
      {providers.includes("apple") && (
        <button type="button" onClick={() => signIn("apple", { callbackUrl })} className="btn-secondary w-full">
          Apple
        </button>
      )}
    </div>
  );
}

export function safeNext(next: string | null | undefined, fallback = "/inicio"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
