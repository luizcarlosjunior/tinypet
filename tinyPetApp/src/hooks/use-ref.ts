import { useQuery } from "@tanstack/react-query";
import { api, qs } from "@/lib/api";
import type { Brand, OwnerTerm, Species } from "@/lib/types";

export function useSpecies() {
  return useQuery({ queryKey: ["ref", "species"], queryFn: () => api<Species[]>("/ref/species", { anonymous: true }), staleTime: 60 * 60_000 });
}
export function useOwnerTerms() {
  return useQuery({ queryKey: ["ref", "owner-terms"], queryFn: () => api<OwnerTerm[]>("/ref/owner-terms", { anonymous: true }), staleTime: 60 * 60_000 });
}
export function useBrands() {
  return useQuery({ queryKey: ["ref", "brands"], queryFn: () => api<Brand[]>("/ref/brands"), staleTime: 60 * 60_000 });
}
export function usePartnerTypes() {
  return useQuery({ queryKey: ["ref", "partner-types"], queryFn: () => api<{ key: string; label: string }[]>("/ref/partner-types", { anonymous: true }), staleTime: 60 * 60_000 });
}
export function useCategories() {
  return useQuery({ queryKey: ["ref", "categories"], queryFn: () => api<{ id: string; key: string; label: string }[]>("/ref/categories", { anonymous: true }), staleTime: 60 * 60_000 });
}

export type CepResult = { zipCode?: string; cep?: string; street?: string; district?: string; city?: string; state?: string; latitude?: number | null; longitude?: number | null };
export function lookupCep(cep: string) {
  return api<CepResult>(`/ref/cep${qs({ cep: cep.replace(/\D/g, "") })}`);
}
