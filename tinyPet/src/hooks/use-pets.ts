"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PetInput } from "@tinypet/shared";

export type Pet = {
  id: string;
  name: string;
  /** Owner opt-in public profile at /pet/<publicSlug>. */
  publicProfile?: boolean;
  publicSlug?: string | null;
  speciesId: string;
  species?: { id: string; key: string; label: string } | null;
  speciesKey?: string;
  breedId: string | null;
  breed?: { id: string; name: string } | null;
  breedOther: string | null;
  color: string | null;
  sex: "MALE" | "FEMALE" | null;
  size: "SMALL" | "MEDIUM" | "LARGE" | "GIANT" | null;
  birthDate: string | null;
  approxAgeMonths: number | null;
  neutered: boolean | null;
  microchip: string | null;
  avatarUrl: string | null;
  temperament: string | null;
  specialCare: string | null;
  feedingNotes: string | null;
  ownerId: string | null;
  status: "ACTIVE" | "DECEASED";
  deceasedAt: string | null;
  memorialNote: string | null;
  streakDays: number;
  level: number;
  /** @deprecated legacy field ("OWNER" | "VIEW" | "PARTNER"); use `role`. */
  access?: string;
  /** "owner": this account owns the pet; "shared": read-only shared account (can only mark tasks done). */
  role?: "owner" | "shared" | "partner";
  owner?: { id: string; name: string; username: string | null; avatarUrl: string | null } | null;
};

/** True when the signed-in account may edit the pet (owner). Shared accounts are read-only. */
export function canEditPet(pet: Pick<Pet, "role"> | null | undefined): boolean {
  return !pet?.role || pet.role === "owner";
}

// Tutor-area hooks: never send the active partner header (X-Partner-Id would switch /pets/** to partner context).
export const petsKey = ["pets"] as const;
export const petKey = (id: string) => ["pets", id] as const;

export function usePets(opts: { includeDeceased?: boolean; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...petsKey, { includeDeceased: !!opts.includeDeceased }],
    queryFn: () => api<Pet[]>(`/pets${opts.includeDeceased ? "?includeDeceased=1" : ""}`, { partnerId: null }),
    enabled: opts.enabled ?? true,
  });
}

export function usePet(id: string) {
  return useQuery({ queryKey: petKey(id), queryFn: () => api<Pet>(`/pets/${id}`, { partnerId: null }), enabled: !!id });
}

export function useCreatePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PetInput) => api<Pet>("/pets", { method: "POST", json: input, partnerId: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: petsKey }),
  });
}

export function useUpdatePet(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PetInput>) => api<Pet>(`/pets/${id}`, { method: "PATCH", json: input, partnerId: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: petsKey });
    },
  });
}

export function useDeletePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`/pets/${id}`, { method: "DELETE", partnerId: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: petsKey }),
  });
}


/** Generic helper for pet sub-resources (/pets/:id/<res>). */
export function usePetResource<T>(petId: string, resource: string, query = "", opts: { enabled?: boolean; retry?: boolean } = {}) {
  return useQuery({
    queryKey: ["pets", petId, resource, query],
    queryFn: () => api<T>(`/pets/${petId}/${resource}${query}`, { partnerId: null }),
    enabled: (opts.enabled ?? true) && !!petId,
    retry: opts.retry ?? false,
  });
}

export function usePetMutation<TInput = unknown, TOut = unknown>(petId: string, resource: string, method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST", invalidate: string[] = [resource]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path = "", ...rest }: { path?: string; body?: TInput }) => api<TOut>(`/pets/${petId}/${resource}${path}`, { method, partnerId: null, ...(rest.body !== undefined ? { json: rest.body } : {}) }),
    onSuccess: () => {
      for (const r of invalidate) qc.invalidateQueries({ queryKey: ["pets", petId, r] });
      qc.invalidateQueries({ queryKey: ["me", "home"] });
    },
  });
}
