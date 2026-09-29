import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAcceptInvite, useInvitePreview } from "@/hooks/use-public";
import { usePets } from "@/hooks/use-pets";
import { useAuth } from "@/lib/auth-store";
import { errorMessage } from "@/lib/api";
import { spacing, useTheme } from "@/lib/theme";
import { Avatar, Button, Card, ErrorState, Loading, Screen, Select, Text } from "@/components/ui";
import { speciesKeyOf } from "@/lib/species";

/** Deep link tinypet://convite/:token and https://tinypet.com.br/convite/:token — accept a partner's client invite and merge pets. */
export default function InviteScreen() {
  const t = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { token: authToken, ready } = useAuth();
  const preview = useInvitePreview(token);
  const myPets = usePets();
  const accept = useAcceptInvite();
  const [merges, setMerges] = useState<Record<string, string | null>>({});
  const p = preview.data;

  const doAccept = async () => {
    try {
      await accept.mutateAsync({ token, petMerges: (p?.pets ?? []).map((pet) => ({ partnerPetId: pet.id, ownerPetId: merges[pet.id] ?? null })) });
      Alert.alert("Convite aceito", `Você agora está vinculado a ${p?.partner.tradeName}.`, [{ text: "Ver meus pets", onPress: () => router.replace("/(tutor)/pets") }]);
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };

  return (
    <Screen>
      {preview.isLoading || !ready ? <Loading /> : null}
      {preview.error ? <ErrorState error={preview.error} onRetry={preview.refetch} /> : null}
      {p ? (
        <>
          <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
            <Avatar uri={p.partner.logoUrl} name={p.partner.tradeName} size={72} square />
            <Text variant="title" style={{ marginTop: spacing.sm, textAlign: "center" }}>
              {p.partner.tradeName} convidou você
            </Text>
            <Text tone="muted" style={{ textAlign: "center" }}>
              Cadastro em nome de {p.clientName}. Ao aceitar, você vê o histórico dos atendimentos no app.
            </Text>
          </View>

          {!authToken ? (
            <Card style={{ backgroundColor: t.primarySoft, borderColor: t.primary }}>
              <Text variant="h3">Entre ou crie sua conta para aceitar</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Button title="Entrar" onPress={() => router.push("/(auth)/entrar")} style={{ flex: 1 }} />
                <Button title="Criar conta" variant="secondary" onPress={() => router.push("/(auth)/cadastro")} style={{ flex: 1 }} />
              </View>
              <Text variant="tiny" tone="faint" style={{ marginTop: spacing.sm }}>
                Depois de entrar, abra o link do convite novamente.
              </Text>
            </Card>
          ) : (
            <>
              {p.pets.length ? (
                <Card>
                  <Text variant="h3">Pets cadastrados pelo parceiro</Text>
                  <Text variant="small" tone="muted" style={{ marginBottom: spacing.md }}>
                    Se algum já está no seu app, escolha para unir as fichas; senão, ele será adicionado aos seus pets.
                  </Text>
                  {p.pets.map((pet) => (
                    <View key={pet.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                      <Avatar uri={pet.avatarUrl} name={pet.name} species={speciesKeyOf(pet)} size={40} />
                      <View style={{ flex: 1 }}>
                        <Select
                          label={pet.name}
                          value={merges[pet.id] ?? null}
                          onChange={(v) => setMerges((m) => ({ ...m, [pet.id]: v === "__new__" ? null : v }))}
                          options={[{ value: "__new__", label: "Adicionar como novo pet" }, ...(myPets.data ?? []).filter((mp) => speciesKeyOf(mp) === speciesKeyOf(pet)).map((mp) => ({ value: mp.id, label: `Unir com ${mp.name}` }))]}
                          placeholder="Adicionar como novo pet"
                        />
                      </View>
                    </View>
                  ))}
                </Card>
              ) : null}
              <Button title="Aceitar convite" size="lg" onPress={doAccept} loading={accept.isPending} />
              <Button title="Agora não" variant="ghost" onPress={() => router.replace("/(tutor)/inicio")} style={{ marginTop: spacing.sm }} />
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}
