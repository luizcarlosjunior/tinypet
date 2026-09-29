"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type PetReportItem = {
  id: string;
  name: string;
  species?: { key?: string; label?: string } | string | null;
  speciesLabel?: string;
  breed?: { name?: string } | string | null;
  breedName?: string;
  birthDate?: string | null;
  approxAgeMonths?: number | null;
  ageMonths?: number | null;
  lifeStage?: "PUPPY" | "ADULT" | "SENIOR" | null;
  city?: string | null;
  state?: string | null;
  district?: string | null;
  status?: string;
  sex?: string | null;
  size?: string | null;
  /** partner mode only (admin mode: null) */
  tutor?: { clientId: string | null; name: string | null; linked: boolean; tags: string[]; phone: string | null; email: string | null } | null;
};
export type BrandsReport = {
  byBrandCity: { brandId: string; brand: string; city: string | null; state: string | null; pets: number | string; species: Record<string, number> }[];
  byBrand: { brandId: string; brand: string; pets: number | string }[];
  totalPets: number | string;
};
export type PetReport = { items: PetReportItem[]; groups: { key: string; count: number | string }[]; total: number };

export function usePetReport(partnerId: string | null, query: string) {
  return useQuery({ queryKey: ["reports", "pets", partnerId, query], queryFn: () => api<PetReport>(`/reports/pets${query ? `?${query}` : ""}`), enabled: !!partnerId });
}
export function useBrandsReport(partnerId: string | null) {
  return useQuery({ queryKey: ["reports", "brands", partnerId], queryFn: () => api<BrandsReport>("/reports/brands"), enabled: !!partnerId, retry: 0 });
}
