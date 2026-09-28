import React, { useState } from "react";
import { Alert, View } from "react-native";
import { formatAge, ageInMonths } from "@tinypet/shared";
import { usePetMutations } from "@/hooks/use-pets";
import { errorMessage } from "@/lib/api";
import { fmtDate, todayISO } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { Pet } from "@/lib/types";
import { Button, Card, Input, KeyValue, Sheet, Text } from "@/components/ui";
import { PetForm } from "./PetForm";

const SEX_LABEL: Record<string, string> = { MALE: "Macho", FEMALE: "Fêmea" };
const SIZE_LABEL = { SMALL: "Pequeno", MEDIUM: "Médio", LARGE: "Grande", GIANT: "Gigante" };

/** Ficha: read-only summary, edit sheet, mark deceased (confirm) + undo. */
export function FichaTab({ pet, canEdit, isOwner }: { pet: Pet; canEdit: boolean; isOwner: boolean }) {
  const t = useTheme();
  const { update, markDeceased, undoDeceased } = usePetMutations(pet.id);
  const [editing, setEditing] = useState(false);
  const [deceasedOpen, setDeceasedOpen] = useState(false);
  const [deceasedAt, setDeceasedAt] = useState(todayISO());
  const [note, setNote] = useState("");

  const confirmDeceased = () => {
    Alert.alert("Marcar como falecido?", `Agendamentos futuros de ${pet.name} serão cancelados e as tarefas pausadas. Você pode desfazer depois.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        style: "destructive",
        onPress: async () => {
          try {
            await markDeceased.mutateAsync({ deceasedAt, memorialNote: note || null });
            setDeceasedOpen(false);
          } catch (e) {
            Alert.alert("Erro", errorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <View>
      {pet.status === "DECEASED" ? (
        <Card style={{ backgroundColor: t.surfaceAlt }}>
          <Text variant="h3">Em memória de {pet.name}</Text>
          <Text variant="small" tone="muted">
            Faleceu em {fmtDate(pet.deceasedAt)}
          </Text>
          {pet.memorialNote ? <Text style={{ marginTop: 6 }}>{pet.memorialNote}</Text> : null}
          {isOwner ? (
            <Button
              title="Desfazer"
              variant="secondary"
              size="sm"
              style={{ marginTop: spacing.md, alignSelf: "flex-start" }}
              loading={undoDeceased.isPending}
              onPress={() => undoDeceased.mutateAsync().catch((e) => Alert.alert("Erro", errorMessage(e)))}
            />
          ) : null}
        </Card>
      ) : null}
      <Card>
        <KeyValue k="Espécie" v={pet.species?.label ?? pet.speciesKey} />
        <KeyValue k="Raça" v={pet.breed?.name ?? pet.breedOther} />
        <KeyValue k="Cor / pelagem" v={pet.color} />
        <KeyValue k="Sexo" v={(pet.sex && SEX_LABEL[pet.sex]) || "Não informado"} />
        <KeyValue k="Porte" v={pet.size ? SIZE_LABEL[pet.size] : null} />
        <KeyValue k="Nascimento" v={pet.birthDate ? fmtDate(pet.birthDate) : null} />
        <KeyValue k="Idade" v={formatAge(ageInMonths(pet.birthDate, pet.approxAgeMonths))} />
        <KeyValue k="Castrado" v={pet.neutered == null ? null : pet.neutered ? "Sim" : "Não"} />
        <KeyValue k="Microchip" v={pet.microchip} />
        <KeyValue k="Temperamento" v={pet.temperament} />
        <KeyValue k="Cuidados especiais" v={pet.specialCare} />
        <KeyValue k="Alimentação" v={pet.feedingNotes} />
      </Card>
      {canEdit ? <Button title="Editar ficha" variant="secondary" icon="create-outline" onPress={() => setEditing(true)} /> : null}
      {canEdit && pet.status === "ACTIVE" ? <Button title="Marcar como falecido" variant="ghost" icon="heart-outline" style={{ marginTop: spacing.sm }} onPress={() => setDeceasedOpen(true)} /> : null}

      <Sheet visible={editing} onClose={() => setEditing(false)} title="Editar ficha">
        <PetForm
          initial={pet}
          onSubmit={async (values) => {
            try {
              await update.mutateAsync(values);
              setEditing(false);
            } catch (e) {
              Alert.alert("Erro", errorMessage(e));
            }
          }}
        />
      </Sheet>
      <Sheet visible={deceasedOpen} onClose={() => setDeceasedOpen(false)} title="Marcar como falecido">
        <Input label="Data" placeholder="AAAA-MM-DD" value={deceasedAt} onChangeText={setDeceasedAt} />
        <Input label="Mensagem (opcional)" multiline value={note} onChangeText={setNote} placeholder="Uma lembrança para o memorial" />
        <Button title="Continuar" variant="danger" onPress={confirmDeceased} loading={markDeceased.isPending} />
      </Sheet>
    </View>
  );
}
