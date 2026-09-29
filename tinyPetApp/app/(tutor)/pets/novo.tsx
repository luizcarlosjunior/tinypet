import React, { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { usePetMutations } from "@/hooks/use-pets";
import { ApiError, errorMessage } from "@/lib/api";
import { Screen } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { PetForm } from "@/components/pets/PetForm";
import { isPlanLimit, PlanLimitNotice } from "@/components/PlanLimitNotice";

export default function NewPet() {
  const router = useRouter();
  const { create } = usePetMutations();
  const [limit, setLimit] = useState<ApiError | null>(null);
  return (
    <>
      <BackHeader title="Novo pet" fallback="/(tutor)/pets" />
      <Screen keyboard>
        {limit ? <PlanLimitNotice error={limit} /> : null}
        <PetForm
          submitLabel="Cadastrar pet"
          onSubmit={async (values) => {
            try {
              const pet = await create.mutateAsync(values);
              router.replace(`/(tutor)/pets/${pet.id}`);
            } catch (e) {
              if (isPlanLimit(e)) setLimit(e);
              else Alert.alert("Erro", errorMessage(e));
            }
          }}
        />
      </Screen>
    </>
  );
}
