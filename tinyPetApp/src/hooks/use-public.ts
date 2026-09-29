import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Slot } from "@tinypet/shared";
import { api, apiList, qs } from "@/lib/api";
import type { CatalogItem, InvitePreview, PartnerSummary, PublicPartner } from "@/lib/types";

export type PartnerFilters = { q?: string; type?: string; category?: string; species?: string; minRating?: number; lat?: number; lng?: number; radiusKm?: number; city?: string; state?: string; page?: number };

export function usePartnerSearch(filters: PartnerFilters) {
  return useQuery({
    queryKey: ["public", "partners", filters],
    queryFn: () => apiList<PartnerSummary[]>(`/public/partners${qs({ ...filters, pageSize: 30 })}`, { anonymous: true, partnerId: null }),
  });
}
export function usePublicPartner(slug: string | undefined) {
  return useQuery({ queryKey: ["public", "partner", slug], queryFn: () => api<PublicPartner>(`/public/partners/${slug}`, { partnerId: null }), enabled: !!slug });
}
export function usePublicItem(id: string | undefined) {
  return useQuery({ queryKey: ["public", "item", id], queryFn: () => api<CatalogItem>(`/public/items/${id}`, { partnerId: null }), enabled: !!id });
}
export function useSlots(slug: string | undefined, itemId: string | undefined, date: string | undefined, membershipId?: string) {
  return useQuery({
    queryKey: ["public", "slots", slug, itemId, date, membershipId],
    queryFn: () => api<Slot[]>(`/public/partners/${slug}/slots${qs({ itemId, date, membershipId })}`, { partnerId: null }),
    enabled: !!slug && !!itemId && !!date,
  });
}
export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { partnerId: string; itemId: string; petIds: string[]; startsAt: string; locationType?: string; addressId?: string | null; notes?: string | null }) => api("/bookings", { method: "POST", json: input, partnerId: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "appointments"] });
      qc.invalidateQueries({ queryKey: ["me", "home"] });
    },
  });
}
export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, rating, comment }: { itemId: string; rating: number; comment?: string | null }) => api(`/reviews/items/${itemId}`, { method: "POST", json: { rating, comment }, partnerId: null }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["public", "item", v.itemId] });
      qc.invalidateQueries({ queryKey: ["public", "partner"] });
    },
  });
}

export function useInvitePreview(token: string | undefined) {
  return useQuery({ queryKey: ["invite", token], queryFn: () => api<InvitePreview>(`/invites/${token}`, { anonymous: true, partnerId: null }), enabled: !!token });
}
export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; petMerges?: { partnerPetId: string; ownerPetId: string | null }[] }) => api("/invites/accept", { method: "POST", json: input, partnerId: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pets"] }),
  });
}
