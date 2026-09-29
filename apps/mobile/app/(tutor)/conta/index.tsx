import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-store";
import { useOwnerTerms } from "@/hooks/use-ref";
import { useDeleteAccount, useHome, useUpdateProfile } from "@/hooks/use-me";
import { useUsernameAvailability } from "@/hooks/use-sharing";
import { USERNAME_HINT, usernameProblem, usernameReasonText } from "@/lib/username";
import { errorMessage } from "@/lib/api";
import { pickAndUpload } from "@/lib/upload";
import { unregisterPushToken } from "@/lib/push";
import { spacing, useTheme } from "@/lib/theme";
import { Avatar, Badge, Button, Checkbox, Input, ListItem, Screen, Section, Select, Sheet, Text } from "@/components/ui";

export default function Account() {
  const t = useTheme();
  const router = useRouter();
  const { user, memberships, setContext, signOut, refresh } = useAuth();
  const terms = useOwnerTerms();
  const update = useUpdateProfile();
  const del = useDeleteAccount();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [uploading, setUploading] = useState(false);
  const home = useHome();
  const pendingInvites = home.data?.pendingPetInvites ?? 0;
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const uname = username.trim().toLowerCase();
  const avail = useUsernameAvailability(uname, user?.username);
  const localProblem = usernameProblem(uname);
  const unchanged = uname === (user?.username ?? "");
  const usernameStatus: { error?: string; hint: string } = localProblem
    ? { error: localProblem, hint: USERNAME_HINT }
    : usernameError
      ? { error: usernameError, hint: USERNAME_HINT }
      : !uname || unchanged
        ? { hint: USERNAME_HINT }
        : avail.checking
          ? { hint: "Verificando disponibilidade…" }
          : avail.error
            ? { hint: "Não foi possível verificar agora. Você pode tentar salvar mesmo assim." }
            : avail.data?.available === false
              ? { error: usernameReasonText(avail.data.reason), hint: USERNAME_HINT }
              : avail.data?.available
                ? { hint: `@${uname} está disponível.` }
                : { hint: USERNAME_HINT };
  const canSaveUsername = !!uname && !unchanged && !localProblem && !avail.checking && avail.data?.available !== false;
  const saveUsername = async () => {
    setUsernameError(null);
    try {
      await update.mutateAsync({ username: uname });
      await refresh();
      setUsernameOpen(false);
    } catch (e) {
      setUsernameError(errorMessage(e));
    }
  };

  const patch = async (input: Parameters<typeof update.mutateAsync>[0]) => {
    try {
      await update.mutateAsync(input);
      await refresh();
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };
  const changeAvatar = async () => {
    setUploading(true);
    try {
      const up = await pickAndUpload("USER_AVATAR", { avatar: true });
      if (up) await patch({ avatarUrl: up.url });
    } catch (e) {
      Alert.alert("Erro no envio", errorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  const switchTo = async (partnerId: string) => {
    await setContext(partnerId);
    router.replace("/(parceiro)/agenda");
  };
  const logout = () =>
    Alert.alert("Sair da conta?", undefined, [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: async () => { await unregisterPushToken(); await signOut(); } },
    ]);
  const deleteAccount = () =>
    Alert.alert("Excluir conta?", "Seus dados, pets e histórico serão removidos conforme a LGPD. Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Continuar",
        style: "destructive",
        onPress: () =>
          Alert.alert("Tem certeza?", "Confirme novamente para excluir sua conta definitivamente.", [
            { text: "Manter conta", style: "cancel" },
            { text: "Excluir definitivamente", style: "destructive", onPress: () => del.mutateAsync().then(signOut).catch((e) => Alert.alert("Erro", errorMessage(e))) },
          ]),
      },
    ]);

  if (!user) return null;
  return (
    <Screen title="Conta">
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl }}>
        <Pressable onPress={changeAvatar} accessibilityRole="button" accessibilityLabel="Alterar foto de perfil" disabled={uploading}>
          <Avatar uri={user.avatarUrl} name={user.name} size={72} />
          <View style={{ position: "absolute", right: -2, bottom: -2, backgroundColor: t.primary, borderRadius: 12, width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{user.name}</Text>
          <Text variant="small" tone="muted">
            {user.email}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
            <Badge label={user.ownerTerm || "Tutor"} tone="primary" />
            {user.plan ? <Badge label={`Plano ${user.plan}`} /> : null}
            {!user.emailVerified ? <Badge label="E-mail não verificado" tone="warning" /> : null}
          </View>
        </View>
      </View>

      <Section title="Perfil">
        <ListItem title="Nome e dados" subtitle={user.name} onPress={() => { setName(user.name); setEditOpen(true); }} />
        <ListItem
          title="Nome de usuário"
          subtitle={user.username ? `@${user.username} · usado para compartilhar pets` : "Defina um @usuario para receber convites de pets"}
          onPress={() => {
            setUsername(user.username ?? "");
            setUsernameError(null);
            setUsernameOpen(true);
          }}
        />
        <Select label="Como quer ser chamado" value={user.ownerTermId ?? null} onChange={(v) => patch({ ownerTermId: v })} options={(terms.data ?? []).map((o) => ({ value: o.id, label: o.label }))} />
        {!user.emailVerified ? <ListItem title="Verificar e-mail ou telefone" onPress={() => router.push("/(auth)/verificar")} /> : null}
      </Section>

      <Section title="Pets compartilhados">
        <ListItem
          title="Convites de pets"
          subtitle={pendingInvites > 0 ? `${pendingInvites} ${pendingInvites === 1 ? "pendente" : "pendentes"}` : "Compartilhamentos e transferências de propriedade"}
          right={pendingInvites > 0 ? <Badge label={String(pendingInvites)} tone="primary" /> : undefined}
          onPress={() => router.push("/(tutor)/convites")}
        />
      </Section>

      <Section title="Contatos e endereços">
        <ListItem title="Telefones e e-mails" onPress={() => router.push("/(tutor)/conta/contatos")} />
        <ListItem title="Endereços" subtitle="Usados para atendimentos a domicílio e busca por perto" onPress={() => router.push("/(tutor)/conta/enderecos")} />
      </Section>

      <Section title="Conteúdo">
        <ListItem title="Blog" subtitle="Dicas e novidades sobre o cuidado com os pets" onPress={() => router.push("/(tutor)/blog")} />
      </Section>

      <Section title="Plano">
        <ListItem title="Meu plano e limites" subtitle={user.plan ? `Plano ${user.plan}` : undefined} onPress={() => router.push("/(tutor)/conta/plano")} />
      </Section>

      <Section title="Privacidade (LGPD)">
        <Checkbox checked={!!user.marketingConsent} onChange={(v) => patch({ marketingConsent: v })} label="Receber ofertas e novidades" description="Necessário para indicações de lojas e promoções" />
        <Checkbox checked={!!user.statsConsent} onChange={(v) => patch({ statsConsent: v })} label="Uso anônimo nas estatísticas" description="Permite comparar comandos com pets semelhantes" />
        <Checkbox checked={!!user.publicPhotosConsent} onChange={(v) => patch({ publicPhotosConsent: v })} label="Fotos públicas" description="Parceiros podem mostrar fotos dos seus pets" />
      </Section>

      {memberships.length ? (
        <Section title="Área do parceiro">
          {memberships.map((m) => (
            <ListItem key={m.membershipId} title={m.partnerName} subtitle={m.role === "OWNER" ? "Dono" : "Equipe"} left={<Avatar uri={m.logoUrl} name={m.partnerName} size={40} square />} onPress={() => switchTo(m.partnerId)} accessibilityLabel={`Entrar como ${m.partnerName}`} />
          ))}
        </Section>
      ) : null}

      <Section title="Sessão">
        <Button title="Sair" variant="secondary" icon="log-out-outline" onPress={logout} />
        <Button title="Excluir minha conta" variant="ghost" onPress={deleteAccount} style={{ marginTop: spacing.sm }} loading={del.isPending} />
      </Section>

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)} title="Editar perfil">
        <Input label="Nome" value={name} onChangeText={setName} />
        <Button title="Salvar" onPress={() => patch({ name }).then(() => setEditOpen(false))} loading={update.isPending} disabled={name.trim().length < 2} />
      </Sheet>

      <Sheet visible={usernameOpen} onClose={() => setUsernameOpen(false)} title="Nome de usuário">
        <Text variant="small" tone="muted" style={{ marginBottom: spacing.sm }}>
          Outras pessoas podem encontrar você pelo @usuario (ou pelo e-mail) para compartilhar um pet.
        </Text>
        <Input
          label="Usuário"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={30}
          value={username}
          onChangeText={(v: string) => {
            setUsername(v.replace(/^@/, "").replace(/\s/g, "").toLowerCase());
            setUsernameError(null);
          }}
          placeholder="seu.usuario"
          error={usernameStatus.error}
          hint={usernameStatus.hint}
        />
        <Button title="Salvar" onPress={() => void saveUsername()} loading={update.isPending} disabled={!canSaveUsername} />
      </Sheet>
    </Screen>
  );
}
