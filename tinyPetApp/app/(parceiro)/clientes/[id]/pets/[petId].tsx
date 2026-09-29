import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { BackHeader } from "@/components/BackHeader";
import { PetDetail } from "@/components/pets/PetDetail";

/** Partner view of a client's pet: reuses the tutor pet screens (history, measurements with vet badge, skills validate, send routine). */
export default function ClientPetScreen() {
  const { petId, id } = useLocalSearchParams<{ petId: string; id: string }>();
  const { activePartnerId } = useAuth();
  const partner = useQuery({
    queryKey: ["partners", activePartnerId, "profile"],
    queryFn: () => api<{ types?: ({ key: string } | string)[] }>(`/partners/${activePartnerId}`),
    enabled: !!activePartnerId,
    staleTime: 10 * 60_000,
  });
  const types = (partner.data?.types ?? []).map((x) => (typeof x === "string" ? x : x.key));
  return (
    <>
      <BackHeader title="Pet do cliente" fallback={`/(parceiro)/clientes/${id}`} />
      <PetDetail petId={petId} mode="partner" partnerTypes={types} />
    </>
  );
}
