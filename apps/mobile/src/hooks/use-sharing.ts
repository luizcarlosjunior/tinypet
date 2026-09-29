import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usernameProblem } from "@/lib/username";
import { api, qs } from "@/lib/api";
import type { MyPetInvites, Pet, PetRole, PetSharing, UsernameAvailability } from "@/lib/types";
import { petKeys } from "./use-pets";

export const sharingKeys = {
  pet: (petId: string) => ["pets", petId, "sharing"] as const,
  invites: ["me", "pet-invites"] as const,
};

/**
 * Caller's role for a pet in the tutor area. Prefers the API `role`; falls back to the owner id
 * (the pet detail may not carry `role`) and to the legacy `access` marker.
 */
export function petRoleOf(pet: Pet | undefined | null, userId: string | undefined | null): PetRole | null {
  if (!pet) return null;
  if (pet.role === "owner" || pet.role === "shared") return pet.role;
  if (pet.ownerId && userId) return pet.ownerId === userId ? "owner" : "shared";
  if (pet.access === "OWNER") return "owner";
  if (pet.access === "VIEW" || pet.access === "EDIT") return "shared";
  return null;
}

export function useSharing(petId: string, enabled = true) {
  return useQuery({ queryKey: sharingKeys.pet(petId), queryFn: () => api<PetSharing>(`/pets/${petId}/sharing`), enabled: enabled && !!petId });
}

export function useSharingMutations(petId: string) {
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: sharingKeys.pet(petId) });
  };
  const invAll = () => {
    inv();
    qc.invalidateQueries({ queryKey: petKeys.all });
    qc.invalidateQueries({ queryKey: ["me", "home"] });
  };
  const invite = useMutation({ mutationFn: (handle: string) => api(`/pets/${petId}/share-invites`, { method: "POST", json: { handle } }), onSuccess: inv });
  const cancelInvite = useMutation({ mutationFn: (inviteId: string) => api(`/pets/${petId}/share-invites/${inviteId}`, { method: "DELETE" }), onSuccess: inv });
  const removeShare = useMutation({ mutationFn: (userId: string) => api(`/pets/${petId}/shares/${userId}`, { method: "DELETE" }), onSuccess: inv });
  const leave = useMutation({
    mutationFn: () => api(`/pets/${petId}/leave`, { method: "POST" }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: petKeys.one(petId) });
      qc.invalidateQueries({ queryKey: petKeys.all });
      qc.invalidateQueries({ queryKey: ["me", "home"] });
    },
  });
  /** `password` for accounts with password; otherwise `code` from sendTransferCode. */
  const transfer = useMutation({ mutationFn: (input: { toUserId: string; password?: string; code?: string }) => api(`/pets/${petId}/ownership-transfers`, { method: "POST", json: input }), onSuccess: inv });
  const sendTransferCode = useMutation({ mutationFn: () => api(`/pets/${petId}/ownership-transfers/code`, { method: "POST" }) });
  const cancelTransfer = useMutation({ mutationFn: (transferId: string) => api(`/pets/${petId}/ownership-transfers/${transferId}`, { method: "DELETE" }), onSuccess: invAll });
  return { invite, cancelInvite, removeShare, leave, transfer, sendTransferCode, cancelTransfer };
}

export function useMyPetInvites() {
  return useQuery({ queryKey: sharingKeys.invites, queryFn: () => api<MyPetInvites>("/me/pet-invites") });
}

export function usePetInviteActions() {
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: sharingKeys.invites });
    qc.invalidateQueries({ queryKey: petKeys.all });
    qc.invalidateQueries({ queryKey: ["me", "home"] });
  };
  const answerShare = useMutation({ mutationFn: ({ id, accept }: { id: string; accept: boolean }) => api(`/me/pet-invites/${id}/${accept ? "accept" : "decline"}`, { method: "POST" }), onSuccess: inv });
  const answerTransfer = useMutation({ mutationFn: ({ id, accept }: { id: string; accept: boolean }) => api(`/me/pet-transfers/${id}/${accept ? "accept" : "decline"}`, { method: "POST" }), onSuccess: inv });
  return { answerShare, answerTransfer };
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

/** Debounced `GET /auth/username-available`. Only queries when the value passes the local rules and differs from `current`. */
export function useUsernameAvailability(value: string, current?: string | null) {
  const u = useDebounced(value.trim().toLowerCase(), 450);
  const enabled = !usernameProblem(u) && !!u && u !== (current ?? "");
  const q = useQuery({ queryKey: ["auth", "username-available", u], queryFn: () => api<UsernameAvailability>(`/auth/username-available${qs({ u })}`), enabled, staleTime: 30_000, retry: false });
  const settled = u === value.trim().toLowerCase();
  return { ...q, checking: enabled && (!settled || q.isFetching), enabled, debounced: u };
}
