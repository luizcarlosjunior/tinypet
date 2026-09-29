import React from "react";
import { useLocalSearchParams } from "expo-router";
import { BackHeader } from "@/components/BackHeader";
import { PetDetail } from "@/components/pets/PetDetail";

export default function PetScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  return (
    <>
      <BackHeader title="Ficha do pet" fallback="/(tutor)/pets" />
      <PetDetail petId={id} mode="owner" initialTab={(tab as never) ?? "ficha"} />
    </>
  );
}
