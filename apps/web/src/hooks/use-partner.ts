"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getActivePartnerId, setActivePartnerId } from "@/lib/api-client";
import { sessionContextKey, useSessionContext } from "@/hooks/use-session-context";
import type { Membership, Partner, PlanInfo } from "@/types/api";

export type PartnerContextValue = {
  partnerId: string | null;
  setPartnerId: (id: string) => void;
  memberships: Membership[];
  membership: Membership | null;
  ready: boolean;
};

export const PartnerContext = createContext<PartnerContextValue | null>(null);

/** Resolves the active partner id from localStorage, defaulting to the first membership. Used by the panel shell. */
export function usePartnerState(): PartnerContextValue {
  const session = useSessionContext();
  const qc = useQueryClient();
  const [partnerId, setState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const memberships = useMemo(() => session.data?.memberships ?? [], [session.data]);

  useEffect(() => {
    if (!session.data) return;
    const stored = getActivePartnerId();
    const valid = stored && memberships.some((m) => m.partnerId === stored) ? stored : memberships[0]?.partnerId ?? null;
    if (valid && valid !== stored) setActivePartnerId(valid);
    setState(valid);
    setReady(true);
  }, [session.data, memberships]);

  const setPartnerId = useCallback(
    (id: string) => {
      setActivePartnerId(id);
      setState(id);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" && q.queryKey[0] !== "ref" && q.queryKey[0] !== "notifications" });
    },
    [qc],
  );

  const membership = memberships.find((m) => m.partnerId === partnerId) ?? null;
  return { partnerId, setPartnerId, memberships, membership, ready };
}

/**
 * Active partner for panel pages. Works with or without the PartnerContext provider
 * (falls back to reading localStorage + session memberships).
 */
export function useActivePartner() {
  const ctx = useContext(PartnerContext);
  const fallback = usePartnerState();
  const state = ctx ?? fallback;
  const qc = useQueryClient();
  const partnerQuery = useQuery({
    queryKey: ["partner", state.partnerId],
    queryFn: () => api<Partner>(`/partners/${state.partnerId}`, { partnerId: state.partnerId }),
    enabled: !!state.partnerId,
  });
  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["partner", state.partnerId] });
    qc.invalidateQueries({ queryKey: sessionContextKey });
  }, [qc, state.partnerId]);
  const isOwner = state.membership?.role === "OWNER";
  return {
    partnerId: state.partnerId,
    membership: state.membership,
    memberships: state.memberships,
    membershipId: state.membership?.membershipId ?? null,
    partner: partnerQuery.data ?? null,
    partnerQuery,
    isOwner,
    canSeeFinance: isOwner || !!state.membership?.canSeeFinance,
    ready: state.ready,
    setPartnerId: state.setPartnerId,
    refresh,
  };
}

export function usePartnerPlan(partnerId: string | null) {
  return useQuery({ queryKey: ["partner", partnerId, "plan"], queryFn: () => api<PlanInfo>(`/partners/${partnerId}/plan`), enabled: !!partnerId });
}
