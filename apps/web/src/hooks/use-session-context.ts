"use client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  avatarUrl: string | null;
  ownerTerm: string;
  ownerTermId: string | null;
  emailVerified: boolean;
  plan: string;
  marketingConsent: boolean;
  publicPhotosConsent?: boolean;
  statsConsent: boolean;
  birthDate?: string | null;
  /** `false` when the account never accepted the current terms (e.g. OAuth sign-up). Absent on older servers. */
  termsAccepted?: boolean;
  /** false for Google/Apple-only accounts (sensitive actions confirmed by e-mail code). */
  hasPassword?: boolean;
};
export type SessionMembership = {
  membershipId: string;
  partnerId: string;
  partnerName: string;
  slug: string;
  logoUrl: string | null;
  role: "OWNER" | "STAFF";
  canSeeFinance: boolean;
  plan: string;
  published: boolean;
};
export type SessionContext = { user: SessionUser; memberships: SessionMembership[] };

export const sessionContextKey = ["auth", "me"] as const;

/** Current user + partner memberships from GET /auth/me. Disabled when there is no NextAuth session. */
export function useSessionContext() {
  const { status } = useSession();
  const q = useQuery({
    queryKey: sessionContextKey,
    queryFn: () => api<SessionContext>("/auth/me"),
    enabled: status === "authenticated",
    staleTime: 60_000,
  });
  return { ...q, user: q.data?.user ?? null, memberships: q.data?.memberships ?? [], isLoggedIn: status === "authenticated", sessionStatus: status };
}
