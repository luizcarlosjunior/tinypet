import React, { useState } from "react";
import { Alert, View } from "react-native";
import { formatAge, ageInMonths } from "@tinypet/shared";
import { usePetMutations } from "@/hooks/use-pets";
import { errorMessage } from "@/lib/api";
import { fmtDate, todayISO, fmtDay } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { Pet } from "@/lib/types";
import { Button, Card, Checkbox, Input, KeyValue, Sheet, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth-store";
import { PetForm } from "./PetForm";
import { MicrochipLookupLinks } from "./Microchip";
import { BreedInfoCard } from "./BreedInfoCard";
import { speciesKeyOf } from "@/lib/species";

const SEX_LABEL: Record<string, string> = { MALE: "Macho", FEMALE: "Fêmea" };
const SIZE_LABEL = { SMALL: "Pequeno", MEDIUM: "Médio", LARGE: "Grande", GIANT: "Gigante" };

/** Ficha: read-only summary, edit sheet and the (irreversible, password-confirmed) death registration. */
export function FichaTab({ pet, canEdit, isOwner: _isOwner, canRegisterDeath = false }: { pet: Pet; canEdit: boolean; isOwner: boolean; canRegisterDeath?: boolean }) {
  const t = useTheme();
  const { user } = useAuth();
  const hasPassword = user?.hasPassword !== false;
  const { update, markDeceased, sendDeceasedCode } = usePetMutations(pet.id);
  const [editing, setEditing] = useState(false);
  const [deceasedOpen, setDeceasedOpen] = useState(false);
  const [deceasedAt, setDeceasedAt] = useState(todayISO());
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeDeceased = () => {
    setDeceasedOpen(false);
    setAck(false);
    setPassword("");
    setCode("");
    setError(null);
  };
  const proofOk = hasPassword ? password.length > 0 : /^\d{6}$/.test(code);
  const submitDeceased = async () => {
    setError(null);
    try {
      await markDeceased.mutateAsync({ deceasedAt, memorialNote: note.trim() || null, ...(hasPassword ? { password } : { code }) });
      closeDeceased();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <View>
      {pet.status === "DECEASED" ? (
        <Card style={{ backgroundColor: t.surfaceAlt }}>
          <Text variant="h3">Em memória de {pet.name}</Text>
          <Text variant="small" tone="muted">
            Faleceu em {fmtDay(pet.deceasedAt)}
          </Text>
          {pet.memorialNote ? <Text style={{ marginTop: 6 }}>{pet.memorialNote}</Text> : null}
        </Card>
      ) : null}
      <Card>
        <KeyValue k="Espécie" v={pet.species?.label ?? speciesKeyOf(pet)} />
        <KeyValue k="Raça" v={pet.breed?.name ?? pet.breedOther} />
        <KeyValue k="Cor / pelagem" v={pet.color} />
        <KeyValue k="Sexo" v={(pet.sex && SEX_LABEL[pet.sex]) || "Não informado"} />
        <KeyValue k="Porte" v={pet.size ? SIZE_LABEL[pet.size] : null} />
        <KeyValue k="Nascimento" v={pet.birthDate ? fmtDay(pet.birthDate) : null} />
        <KeyValue k="Idade" v={formatAge(ageInMonths(pet.birthDate, pet.approxAgeMonths))} />
        <KeyValue k="Castrado" v={pet.neutered == null ? null : pet.neutered ? "Sim" : "Não"} />
        <KeyValue k="Microchip" v={pet.microchip || "Não possui"} />
        {pet.microchip ? <MicrochipLookupLinks chip={pet.microchip} /> : null}
        <KeyValue k="Temperamento" v={pet.temperament} />
        <KeyValue k="Cuidados especiais" v={pet.specialCare} />
        <KeyValue k="Alimentação" v={pet.feedingNotes} />
      </Card>
      <BreedInfoCard breedId={pet.breedId} breedName={pet.breed?.name} />
      {canEdit ? <Button title="Editar ficha" variant="secondary" icon="create-outline" onPress={() => setEditing(true)} /> : null}
      {canRegisterDeath && pet.status === "ACTIVE" ? <Button title="Registrar falecimento" variant="ghost" icon="heart-outline" style={{ marginTop: spacing.sm }} onPress={() => setDeceasedOpen(true)} /> : null}

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
      <Sheet visible={deceasedOpen} onClose={closeDeceased} title={`Registrar o falecimento de ${pet.name}`}>
        <Card style={{ backgroundColor: t.warningSoft }}>
          <Text style={{ fontWeight: "700" }} accessibilityRole="alert">
            Este registro é definitivo e não pode ser desfeito.
          </Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            Os agendamentos futuros serão cancelados, as tarefas e lembretes param e o perfil vira um memorial. A ficha, a galeria e o histórico continuam guardados.
          </Text>
        </Card>
        <Input label="Data do falecimento" placeholder="AAAA-MM-DD" value={deceasedAt} onChangeText={setDeceasedAt} />
        <Input label="Mensagem (opcional)" multiline maxLength={1000} value={note} onChangeText={setNote} placeholder="Uma lembrança para o memorial" />
        <Checkbox checked={ack} onChange={setAck} label={`Confirmo que ${pet.name} faleceu e entendo que este registro não pode ser desfeito.`} />
        {hasPassword ? (
          <Input label="Sua senha" secureTextEntry autoComplete="current-password" textContentType="password" value={password} onChangeText={setPassword} />
        ) : (
          <View>
            <Text variant="small" tone="muted">Sua conta entra com Google ou Apple. Para confirmar, enviaremos um código ao seu e-mail.</Text>
            {codeSent ? <Input label="Código recebido por e-mail" keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" value={code} onChangeText={(v: string) => setCode(v.replace(/\D/g, ""))} /> : null}
            <Button
              title={codeSent ? "Reenviar código" : "Enviar código"}
              variant="secondary"
              loading={sendDeceasedCode.isPending}
              onPress={() =>
                sendDeceasedCode
                  .mutateAsync()
                  .then(() => setCodeSent(true))
                  .catch((e) => setError(errorMessage(e)))
              }
            />
          </View>
        )}
        {error ? (
          <Text variant="small" style={{ color: t.danger, marginTop: 6 }} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button title="Registrar falecimento" variant="danger" disabled={!ack || !proofOk} onPress={() => void submitDeceased()} loading={markDeceased.isPending} style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
}
