import React, { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PET_SOCIAL_NETWORKS, parsePetSocialUsername, petSocialProfileUrl, type PetSocialNetworkKey } from "@tinypet/shared";
import { useSaveSocialProfiles, useSocialProfiles } from "@/hooks/use-pets";
import { errorMessage } from "@/lib/api";
import { openExternal } from "@/lib/links";
import { spacing, useTheme } from "@/lib/theme";
import { Button, Empty, ErrorState, Input, ListItem, Loading, Section } from "@/components/ui";

const ICON: Record<PetSocialNetworkKey, keyof typeof Ionicons.glyphMap> = {
  INSTAGRAM: "logo-instagram",
  TIKTOK: "logo-tiktok",
  YOUTUBE: "logo-youtube",
  FACEBOOK: "logo-facebook",
  X: "logo-twitter",
  THREADS: "at-outline",
  PINTEREST: "logo-pinterest",
};

/**
 * Redes sociais: the user types the @username or pastes the profile URL; only the username is stored
 * (normalized here and again by the API). Links are rebuilt with `petSocialProfileUrl`.
 */
export function RedesSociaisTab({ petId, canEdit }: { petId: string; canEdit: boolean }) {
  const t = useTheme();
  const q = useSocialProfiles(petId);
  const save = useSaveSocialProfiles(petId);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Partial<Record<PetSocialNetworkKey, string>>>({});
  const fromServer = () => Object.fromEntries((q.data ?? []).map((p) => [p.network, `@${p.username}`])) as Partial<Record<PetSocialNetworkKey, string>>;

  useEffect(() => {
    if (q.data) setValues(fromServer());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const profiles = q.data ?? [];

  const errors: Partial<Record<PetSocialNetworkKey, string>> = {};
  for (const n of PET_SOCIAL_NETWORKS) {
    const v = values[n.key]?.trim();
    if (!v) continue;
    const r = parsePetSocialUsername(n.key, v);
    if (!r.ok) errors[n.key] = r.message;
  }
  const hasErrors = Object.keys(errors).length > 0;

  const normalize = (key: PetSocialNetworkKey) => {
    const v = values[key]?.trim();
    if (!v) return;
    const r = parsePetSocialUsername(key, v);
    if (r.ok) setValues((s) => ({ ...s, [key]: `@${r.username}` }));
  };

  const submit = async () => {
    if (hasErrors) return;
    try {
      await save.mutateAsync(PET_SOCIAL_NETWORKS.map((n) => ({ network: n.key, username: values[n.key]?.trim() ?? "" })).filter((p) => p.username));
      setEditing(false);
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };

  if (editing) {
    return (
      <Section title="Redes sociais">
        {PET_SOCIAL_NETWORKS.map((n) => (
          <Input
            key={n.key}
            label={n.label}
            placeholder={n.placeholder}
            value={values[n.key] ?? ""}
            onChangeText={(v) => setValues((s) => ({ ...s, [n.key]: v }))}
            onBlur={() => normalize(n.key)}
            error={errors[n.key]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            maxLength={500}
          />
        ))}
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <Button title="Salvar" onPress={submit} loading={save.isPending} disabled={hasErrors} />
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => {
              setValues(fromServer());
              setEditing(false);
            }}
          />
        </View>
      </Section>
    );
  }

  return (
    <Section title="Redes sociais" right={canEdit ? <Button title={profiles.length ? "Editar" : "Adicionar"} size="sm" onPress={() => setEditing(true)} /> : undefined}>
      {profiles.length === 0 ? (
        <Empty icon="at-outline" title="Nenhuma rede social" description={canEdit ? "Digite o @ ou cole o link do perfil do pet — guardamos só o nome de usuário." : undefined} />
      ) : null}
      {profiles.map((p) => {
        const net = PET_SOCIAL_NETWORKS.find((n) => n.key === p.network)!;
        return (
          <ListItem
            key={p.network}
            left={<Ionicons name={ICON[p.network]} size={22} color={t.ink} />}
            title={`@${p.username}`}
            subtitle={net.label}
            onPress={() => openExternal(petSocialProfileUrl(p.network, p.username))}
            right={<Ionicons name="open-outline" size={18} color={t.inkMuted} />}
            chevron={false}
          />
        );
      })}
    </Section>
  );
}
