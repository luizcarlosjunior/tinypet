import React, { useState } from "react";
import { Alert, Linking, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ageInMonths, formatAge } from "@tinypet/shared";
import { useClient, useClientInvites, useClientMutations } from "@/hooks/use-partner";
import { api, errorMessage } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { fmtDate } from "@/lib/format";
import { addressText, linksFor, openRoute } from "@/lib/nav";
import { spacing } from "@/lib/theme";
import { Avatar, Badge, Button, Card, ErrorState, Input, ListItem, Loading, Screen, Section, Sheet, Text } from "@/components/ui";
import { AddressForm } from "@/components/AddressForm";
import { BackHeader } from "@/components/BackHeader";

const PHONE_TYPE = { MOBILE: "Celular", LANDLINE: "Fixo", WHATSAPP: "WhatsApp" } as const;

export default function ClientDetail() {
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useClient(id);
  const invites = useClientInvites(id);
  const { invite } = useClientMutations(id);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const c = q.data;
  const pendingInvite = (invites.data ?? c?.invites ?? []).find((i) => !i.acceptedAt);

  const sendInvite = async () => {
    try {
      await invite.mutateAsync({ email: inviteEmail || undefined });
      setInviteOpen(false);
      Alert.alert("Convite enviado", "O cliente recebe um e-mail com o link para aceitar e ver os pets no app.");
      invites.refetch();
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };

  return (
    <>
      <BackHeader title="Cliente" fallback="/(parceiro)/clientes" />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {c ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg }}>
              <Avatar name={c.name} size={64} />
              <View style={{ flex: 1 }}>
                <Text variant="title">{c.name}</Text>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {c.userId || c.user ? <Badge label="Usa o app" tone="success" icon="phone-portrait-outline" /> : pendingInvite ? <Badge label="Convite pendente" tone="warning" /> : <Badge label="Sem conta no app" />}
                  {c.birthDate ? <Badge label={`Aniversário ${fmtDate(c.birthDate, "dd/MM")}`} icon="gift-outline" /> : null}
                  {(c.tags ?? []).map((tg) => (
                    <Badge key={tg} label={tg} />
                  ))}
                </View>
              </View>
            </View>
            {!(c.userId || c.user) ? (
              <Button title={pendingInvite ? "Reenviar convite" : "Convidar para o app"} icon="mail-outline" variant="secondary" onPress={() => { setInviteEmail(c.primaryEmail ?? c.emails?.[0]?.address ?? ""); setInviteOpen(true); }} style={{ marginBottom: spacing.md }} />
            ) : null}
            {c.notes ? (
              <Card>
                <Text variant="small">{c.notes}</Text>
              </Card>
            ) : null}

            <Section title="Pets" right={<Button title="Novo pet" size="sm" icon="add" onPress={() => router.push(`/(parceiro)/clientes/${id}/pets/novo`)} />}>
              {(c.pets ?? []).length === 0 ? (
                <Text variant="small" tone="muted">
                  Nenhum pet vinculado.
                </Text>
              ) : null}
              {(c.pets ?? []).map((p) => (
                <ListItem
                  key={p.id}
                  title={p.name}
                  subtitle={[p.species?.label ?? p.speciesKey, p.breed?.name ?? p.breedOther, formatAge(ageInMonths(p.birthDate, p.approxAgeMonths))].filter(Boolean).join(" · ")}
                  left={<Avatar uri={p.avatarUrl} name={p.name} species={p.speciesKey} size={44} />}
                  right={p.status === "DECEASED" ? <Badge label="Em memória" icon="heart" /> : undefined}
                  onPress={() => router.push(`/(parceiro)/clientes/${id}/pets/${p.id}`)}
                />
              ))}
            </Section>

            <Section title="Contatos">
              {(c.phones ?? []).map((ph) => (
                <ListItem key={ph.id} title={ph.number} subtitle={PHONE_TYPE[ph.type]} chevron={false} onPress={() => Linking.openURL(ph.type === "WHATSAPP" ? `https://wa.me/${ph.number.replace(/\D/g, "")}` : `tel:${ph.number}`)} accessibilityLabel={`Ligar para ${ph.number}`} />
              ))}
              {(c.emails ?? []).map((e) => (
                <ListItem key={e.id} title={e.address} subtitle="E-mail" chevron={false} onPress={() => Linking.openURL(`mailto:${e.address}`)} />
              ))}
              {!c.phones?.length && !c.emails?.length ? (
                <Text variant="small" tone="muted">
                  Nenhum contato cadastrado.
                </Text>
              ) : null}
            </Section>

            <Section title="Endereços" right={<Button title="Adicionar" size="sm" onPress={() => setAddrOpen(true)} />}>
              {(c.addresses ?? []).map((a) => (
                <ListItem key={a.id} title={a.label || addressText(a)} subtitle={[a.label ? addressText(a) : null, a.accessNotes].filter(Boolean).join(" · ") || null} right={a.isPrimary ? <Badge label="Principal" tone="primary" /> : undefined} onPress={() => openRoute(linksFor(a))} chevron={false} accessibilityLabel={`Como chegar em ${a.label || addressText(a)}`} />
              ))}
              {!c.addresses?.length ? (
                <Text variant="small" tone="muted">
                  Necessário para atendimentos a domicílio.
                </Text>
              ) : null}
            </Section>

            {c.familyMembers?.length ? (
              <Section title="Família">
                {c.familyMembers.map((f) => (
                  <ListItem key={f.id} title={f.name} subtitle={[f.relationship, f.phone].filter(Boolean).join(" · ")} chevron={false} />
                ))}
              </Section>
            ) : null}
          </>
        ) : null}
      </Screen>
      <Sheet visible={inviteOpen} onClose={() => setInviteOpen(false)} title="Convidar para o app">
        <Input label="E-mail do cliente" keyboardType="email-address" autoCapitalize="none" value={inviteEmail} onChangeText={setInviteEmail} />
        <Text variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
          Ao aceitar, o cliente vê os pets cadastrados por você e pode unir com os pets que já tem.
        </Text>
        <Button title="Enviar convite" onPress={sendInvite} loading={invite.isPending} disabled={!inviteEmail.includes("@")} />
      </Sheet>
      <Sheet visible={addrOpen} onClose={() => setAddrOpen(false)} title="Novo endereço">
        <AddressForm
          onSubmit={async (v) => {
            try {
              await api(`/clients/${id}/addresses`, { method: "POST", json: v });
              qc.invalidateQueries({ queryKey: ["clients"] });
              setAddrOpen(false);
            } catch (e) {
              Alert.alert("Erro", errorMessage(e));
            }
          }}
        />
      </Sheet>
    </>
  );
}
