import React from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-store";
import { useNotifications } from "@/hooks/use-me";
import { unregisterPushToken } from "@/lib/push";
import { spacing } from "@/lib/theme";
import { Avatar, Badge, Button, ListItem, Screen, Section, Text } from "@/components/ui";

export default function More() {
  const router = useRouter();
  const { user, memberships, activeMembership, setContext, signOut } = useAuth();
  const notifications = useNotifications();
  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;

  const goTutor = async () => {
    await setContext(null);
    router.replace("/(tutor)/inicio");
  };
  const logout = () =>
    Alert.alert("Sair da conta?", undefined, [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: async () => { await unregisterPushToken(); await signOut(); } },
    ]);

  return (
    <Screen title="Mais">
      {activeMembership ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl }}>
          <Avatar uri={activeMembership.logoUrl} name={activeMembership.partnerName} size={56} square />
          <View style={{ flex: 1 }}>
            <Text variant="h2">{activeMembership.partnerName}</Text>
            <Text variant="small" tone="muted">
              {user?.name} · {activeMembership.role === "OWNER" ? "Dono" : "Equipe"}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
              {activeMembership.published === false ? <Badge label="Perfil não publicado" tone="warning" /> : null}
              {activeMembership.plan ? <Badge label={`Plano ${activeMembership.plan}`} /> : null}
            </View>
          </View>
        </View>
      ) : null}

      <Section title="Contexto">
        <ListItem title="Voltar para área do tutor" subtitle="Seus pets, agenda e contratos" onPress={goTutor} />
        {memberships.filter((m) => m.partnerId !== activeMembership?.partnerId).map((m) => (
          <ListItem key={m.membershipId} title={m.partnerName} subtitle={m.role === "OWNER" ? "Dono" : "Equipe"} left={<Avatar uri={m.logoUrl} name={m.partnerName} size={36} square />} onPress={() => setContext(m.partnerId)} accessibilityLabel={`Trocar para ${m.partnerName}`} />
        ))}
      </Section>

      <Section title="Ferramentas">
        <ListItem title="Notificações" subtitle={unread ? `${unread} não lidas` : "Tudo lido"} right={unread ? <Badge label={String(unread)} tone="primary" /> : undefined} onPress={() => router.push("/(parceiro)/mais/notificacoes")} />
        <ListItem title="Rota do dia" subtitle="Visitas a domicílio de hoje" onPress={() => router.push("/(parceiro)/agenda/rota")} />
        <ListItem title="Catálogo, financeiro e equipe" subtitle="Disponíveis na versão web" chevron={false} />
      </Section>

      <Section title="Sessão">
        <Button title="Sair" variant="secondary" icon="log-out-outline" onPress={logout} />
      </Section>
    </Screen>
  );
}
