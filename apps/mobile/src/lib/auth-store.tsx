import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RegisterInput } from "@tinypet/shared";
import { api, onUnauthorized, setApiContext } from "./api";
import { PARTNER_KEY, getPref, getToken, setPref, setToken } from "./storage";
import type { AuthPayload, Membership, User } from "./types";

type AuthState = {
  ready: boolean;
  token: string | null;
  user: User | null;
  memberships: Membership[];
  activePartnerId: string | null;
  activeMembership: Membership | null;
  setContext: (partnerId: string | null) => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthPayload>;
  signUp: (input: RegisterInput) => Promise<AuthPayload>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const signingOut = useRef(false);

  const applyPayload = useCallback(async (p: AuthPayload) => {
    setApiContext({ token: p.token });
    await setToken(p.token);
    setTokenState(p.token);
    setUser(p.user);
    setMemberships(p.memberships ?? []);
  }, []);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      setApiContext({ token: null, partnerId: null });
      await setToken(null);
      await setPref(PARTNER_KEY, null);
      setTokenState(null);
      setUser(null);
      setMemberships([]);
      setActivePartnerId(null);
    } finally {
      signingOut.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    const me = await api<{ user: User; memberships: Membership[] }>("/auth/me");
    setUser(me.user);
    setMemberships(me.memberships ?? []);
  }, []);

  // Boot: restore token + partner context, then validate with /auth/me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, p] = await Promise.all([getToken(), getPref(PARTNER_KEY)]);
      if (cancelled) return;
      if (t) {
        setApiContext({ token: t, partnerId: p });
        setTokenState(t);
        setActivePartnerId(p);
        try {
          const me = await api<{ user: User; memberships: Membership[] }>("/auth/me");
          if (cancelled) return;
          setUser(me.user);
          setMemberships(me.memberships ?? []);
          // Drop a stale partner context (membership removed).
          if (p && !(me.memberships ?? []).some((m) => m.partnerId === p)) {
            setApiContext({ partnerId: null });
            await setPref(PARTNER_KEY, null);
            setActivePartnerId(null);
          }
        } catch (e: unknown) {
          const status = (e as { status?: number }).status;
          if (status === 401 || status === 403) await signOut();
          // Network errors: keep the token and let screens retry.
        }
      }
      setReady(true);
    })();
    onUnauthorized(() => {
      void signOut();
    });
    return () => {
      cancelled = true;
      onUnauthorized(null);
    };
  }, [signOut]);

  const setContext = useCallback(async (partnerId: string | null) => {
    setApiContext({ partnerId });
    await setPref(PARTNER_KEY, partnerId);
    setActivePartnerId(partnerId);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const p = await api<AuthPayload>("/auth/login", { method: "POST", json: { email, password }, anonymous: true, partnerId: null });
      await applyPayload(p);
      return p;
    },
    [applyPayload],
  );

  const signUp = useCallback(
    async (input: RegisterInput) => {
      const p = await api<AuthPayload>("/auth/register", { method: "POST", json: input, anonymous: true, partnerId: null });
      await applyPayload(p);
      return p;
    },
    [applyPayload],
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      token,
      user,
      memberships,
      activePartnerId,
      activeMembership: memberships.find((m) => m.partnerId === activePartnerId) ?? null,
      setContext,
      signIn,
      signUp,
      signOut,
      refresh,
    }),
    [ready, token, user, memberships, activePartnerId, setContext, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
