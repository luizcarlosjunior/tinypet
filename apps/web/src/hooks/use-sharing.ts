"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type ShareUser = { id: string; name: string; username: string | null; avatarUrl: string | null };
export type PetShare = { userId: string; name: string; username: string | null; avatarUrl: string | null; since: string; transferEligibleAt: string; canTransferNow: boolean };
export type PendingItem = { id: string; to: ShareUser; createdAt: string; expiresAt: string };
export type PetSharing = {
  role: "owner" | "shared";
  owner: ShareUser;
  ownerSince: string;
  /** when the owner may pass ownership on again (null = now) */
  canTransferFrom: string | null;
  shares: PetShare[];
  invites: PendingItem[];
  pendingTransfer: PendingItem | null;
};
export type IncomingItem = { id: string; pet: { id: string; name: string; avatarUrl: string | null; species: { key: string; label: string } | null }; from: ShareUser; createdAt: string; expiresAt: string };
export type MyPetInvites = { shares: IncomingItem[]; transfers: IncomingItem[] };

export const sharingKey = (petId: string) => ["pets", petId, "sharing"] as const;
export const myPetInvitesKey = ["me", "pet-invites"] as const;

export function usePetSharing(petId: string) {
  return useQuery({ queryKey: sharingKey(petId), queryFn: () => api<PetSharing>(`/pets/${petId}/sharing`), enabled: !!petId, retry: false });
}

/** Mutations on /pets/:id/... that refresh the sharing panel (and pet lists). */
export function useSharingMutation<TBody = unknown>(petId: string, method: "POST" | "DELETE", path: string | ((arg: string) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arg = "", body }: { arg?: string; body?: TBody }) =>
      api<unknown>(`/pets/${petId}${typeof path === "function" ? path(arg) : path}`, { method, partnerId: null, ...(body !== undefined ? { json: body } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sharingKey(petId) });
      qc.invalidateQueries({ queryKey: ["pets"] });
    },
  });
}

export function useMyPetInvites() {
  return useQuery({ queryKey: myPetInvitesKey, queryFn: () => api<MyPetInvites>("/me/pet-invites", { partnerId: null }) });
}

export function useRespondPetInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id, action }: { kind: "share" | "transfer"; id: string; action: "accept" | "decline" }) =>
      api<{ id: string; status: string; petId: string }>(`/me/${kind === "share" ? "pet-invites" : "pet-transfers"}/${id}/${action}`, { method: "POST", partnerId: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: myPetInvitesKey });
      qc.invalidateQueries({ queryKey: ["me", "home"] });
      qc.invalidateQueries({ queryKey: ["pets"] });
    },
  });
}

export type UsernameCheck = { available: boolean; reason?: "INVALID" | "RESERVED" | "TAKEN" };
export function checkUsername(u: string) {
  return api<UsernameCheck>(`/auth/username-available?u=${encodeURIComponent(u)}`, { partnerId: null });
}
