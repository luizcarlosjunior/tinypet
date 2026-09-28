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
  client?: { id?: string; name?: string; phone?: string | null } | null;
  clientName?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  contact?: string | null;
};
export type PetReport = { items: PetReportItem[]; groups: { key: string; count: number | string }[]; total: number };

export function usePetReport(partnerId: string | null, query: string) {
  return useQuery({ queryKey: ["reports", "pets", partnerId, query], queryFn: () => api<PetReport>(`/reports/pets${query ? `?${query}` : ""}`), enabled: !!partnerId });
}
export function useBrandsReport(partnerId: string | null) {
  return useQuery({ queryKey: ["reports", "brands", partnerId], queryFn: () => api<unknown>("/reports/brands"), enabled: !!partnerId, retry: 0 });
}
