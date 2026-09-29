import React from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useClientMutations } from "@/hooks/use-partner";
import { errorMessage } from "@/lib/api";
import { Screen } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { PetForm } from "@/components/pets/PetForm";

export default function NewClientPet() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { createPet } = useClientMutations(id);
  return (
    <>
      <BackHeader title="Novo pet do cliente" />
      <Screen keyboard>
        <PetForm
          submitLabel="Cadastrar pet"
          onSubmit={async (values) => {
            try {
              const pet = await createPet.mutateAsync(values);
              router.replace(`/(parceiro)/clientes/${id}/pets/${pet.id}`);
            } catch (e) {
              Alert.alert("Erro", errorMessage(e));
            }
          }}
        />
      </Screen>
    </>
  );
}
