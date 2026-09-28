"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Species, Category, Brand, PartnerTypeRef } from "@/types/api";

const day = 24 * 60 * 60 * 1000;

export function useSpecies() {
  return useQuery({ queryKey: ["ref", "species"], queryFn: () => api<Species[]>("/ref/species", { partnerId: null }), staleTime: day });
}
export function useCategories() {
  return useQuery({ queryKey: ["ref", "categories"], queryFn: () => api<Category[]>("/ref/categories", { partnerId: null }), staleTime: day });
}
export function useBrands() {
  return useQuery({ queryKey: ["ref", "brands"], queryFn: () => api<Brand[]>("/ref/brands", { partnerId: null }), staleTime: day });
}
export function usePartnerTypes() {
  return useQuery({ queryKey: ["ref", "partner-types"], queryFn: () => api<PartnerTypeRef[]>("/ref/partner-types", { partnerId: null }), staleTime: day });
}

export type CepResult = { zipCode: string; street: string; district: string; city: string; state: string; complement?: string };
export async function lookupCep(cep: string): Promise<CepResult | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    return await api<CepResult>(`/ref/cep?cep=${d}`, { partnerId: null });
  } catch {
    return null;
  }
}
export async function lookupCnpj(cnpj: string): Promise<{ legalName: string; tradeName?: string } | null> {
  try {
    return await api<{ legalName: string; tradeName?: string }>(`/ref/cnpj?cnpj=${cnpj.replace(/\D/g, "")}`, { partnerId: null });
  } catch {
    return null;
  }
}

export type OwnerTerm = { id: string; label: string; isDefault?: boolean };
export function useOwnerTerms() {
  return useQuery({ queryKey: ["ref", "owner-terms"], queryFn: () => api<OwnerTerm[]>("/ref/owner-terms", { partnerId: null }), staleTime: day });
}
