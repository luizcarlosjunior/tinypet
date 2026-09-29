import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useSharing, useSharingMutations } from "@/hooks/use-sharing";
import { useAuth } from "@/lib/auth-store";
import { ApiError, errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { atUser } from "@/lib/username";
import { spacing, useTheme } from "@/lib/theme";
import type { Pet, PetShare, PetSharing } from "@/lib/types";
import { Avatar, Badge, Button, Card, Empty, ErrorState, Input, ListItem, Loading, Section, Sheet, Text } from "@/components/ui";

const TRANSFER_DAYS = 7;

/** Maps the API reasons of POST /ownership-transfers to pt-BR (falls back to the server message). */
function transferErrorText(e: unknown): string {
  if (!(e instanceof ApiError)) return errorMessage(e);
  const d = (e.details ?? {}) as { reason?: string; availableAt?: string };
  const reason = [e.code, d.reason].find((r) => r && ["TRANSFER_TOO_EARLY", "PASSWORD_REQUIRED", "PASSWORD_INVALID", "CODE_REQUIRED", "CODE_INVALID"].includes(r));
  switch (reason) {
    case "TRANSFER_TOO_EARLY":
      return d.availableAt ? `A transferência só fica disponível em ${fmtDate(d.availableAt, "dd/MM/yyyy 'às' HH:mm")}.` : e.message;
    case "PASSWORD_REQUIRED":
      return "Informe sua senha para confirmar.";
    case "PASSWORD_INVALID":
      return "Senha incorreta.";
    case "CODE_REQUIRED":
      return "Informe o código enviado ao seu e-mail.";
    default:
      return errorMessage(e);
  }
}

function handleOf(a: { username?: string | null; name: string }) {
  return atUser(a.username) ?? a.name;
}

/** Compartilhamento: owner manages invites/shares/ownership transfer; a shared account sees the owner and can leave. */
export function CompartilhamentoTab({ pet }: { pet: Pet }) {
  const q = useSharing(pet.id);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error ?? new Error("Não foi possível carregar o compartilhamento")} onRetry={q.refetch} />;
  return q.data.role === "owner" ? <OwnerView pet={pet} data={q.data} /> : <SharedView pet={pet} data={q.data} />;
}

function OwnerView({ pet, data }: { pet: Pet; data: PetSharing }) {
  const t = useTheme();
  const m = useSharingMutations(pet.id);
  const [handle, setHandle] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteOk, setInviteOk] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState<PetShare | null>(null);
  const invites = data.invites ?? [];
  const pending = data.pendingTransfer ?? null;

  const sendInvite = async () => {
    const h = handle.trim();
    if (!h) return;
    setInviteError(null);
    setInviteOk(null);
    try {
      await m.invite.mutateAsync(h);
      setHandle("");
      setInviteOk("Convite enviado. A pessoa precisa aceitar para ter acesso.");
    } catch (e) {
      setInviteError(errorMessage(e));
    }
  };
  const confirmCancelInvite = (id: string, who: string) =>
    Alert.alert("Cancelar convite?", `O convite para ${who} será cancelado.`, [
      { text: "Voltar", style: "cancel" },
      { text: "Cancelar convite", style: "destructive", onPress: () => m.cancelInvite.mutateAsync(id).catch((e) => Alert.alert("Erro", errorMessage(e))) },
    ]);
  const confirmRemove = (s: PetShare) =>
    Alert.alert("Remover compartilhamento?", `${handleOf(s)} deixará de ver ${pet.name}. Você pode convidar novamente depois.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => m.removeShare.mutateAsync(s.userId).catch((e) => Alert.alert("Erro", errorMessage(e))) },
    ]);
  const confirmCancelTransfer = () =>
    pending &&
    Alert.alert("Cancelar transferência?", `A solicitação para ${handleOf(pending.to)} será cancelada.`, [
      { text: "Voltar", style: "cancel" },
      { text: "Cancelar transferência", style: "destructive", onPress: () => m.cancelTransfer.mutateAsync(pending.id).catch((e) => Alert.alert("Erro", errorMessage(e))) },
    ]);

  const deceased = pet.status === "DECEASED";
  const ownerLocked = data.canTransferFrom && new Date(data.canTransferFrom).getTime() > Date.now() ? data.canTransferFrom : null;

  return (
    <View>
      {deceased ? (
        <Card style={{ backgroundColor: t.surfaceAlt }}>
          <Text variant="small" tone="muted">
            Pets em memória não podem ser compartilhados nem transferidos. Você ainda pode remover contas que já têm acesso.
          </Text>
        </Card>
      ) : (
      <Section title="Convidar">
        <Text variant="small" tone="muted" style={{ marginBottom: spacing.sm }}>
          Compartilhe {pet.name} com outra conta do tinyPet. Quem recebe o convite vê a ficha, a galeria e o histórico e pode marcar as tarefas da rotina como feitas — só você altera o cadastro.
        </Text>
        <Input
          label="Nome de usuário ou e-mail"
          placeholder="@usuario ou email@exemplo.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={handle}
          onChangeText={(v: string) => {
            setHandle(v);
            setInviteError(null);
            setInviteOk(null);
          }}
          onSubmitEditing={() => void sendInvite()}
          returnKeyType="send"
          error={inviteError ?? undefined}
          hint={inviteOk ?? undefined}
        />
        <Button title="Enviar convite" icon="person-add-outline" onPress={() => void sendInvite()} loading={m.invite.isPending} disabled={!handle.trim()} />
      </Section>
      )}

      {pending ? (
        <Card style={{ backgroundColor: t.warningSoft }}>
          <Text variant="h3">Transferência pendente</Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            Aguardando {handleOf(pending.to)} aceitar a propriedade de {pet.name}.{pending.expiresAt ? ` Expira em ${fmtDate(pending.expiresAt)}.` : ""}
          </Text>
          <Button title="Cancelar transferência" size="sm" variant="secondary" style={{ marginTop: spacing.sm, alignSelf: "flex-start" }} loading={m.cancelTransfer.isPending} onPress={confirmCancelTransfer} />
        </Card>
      ) : null}

      {invites.length ? (
        <Section title="Convites pendentes">
          {invites.map((inv) => (
            <ListItem
              key={inv.id}
              title={inv.to.name}
              subtitle={[atUser(inv.to.username), `enviado em ${fmtDate(inv.createdAt)}`, inv.expiresAt ? `expira em ${fmtDate(inv.expiresAt)}` : null].filter(Boolean).join(" · ")}
              left={<Avatar uri={inv.to.avatarUrl} name={inv.to.name} size={40} />}
              right={<Button title="Cancelar" size="sm" variant="ghost" onPress={() => confirmCancelInvite(inv.id, handleOf(inv.to))} />}
            />
          ))}
        </Section>
      ) : null}

      <Section title="Compartilhado com">
        {data.shares.length === 0 ? (
          <Empty icon="people-outline" title="Ainda não compartilhado" description="Convide outra conta pelo nome de usuário ou e-mail." />
        ) : (
          data.shares.map((s) => {
            const eligibleAt = s.transferEligibleAt ?? null;
            const canTransfer = s.canTransferNow && !pending && pet.status === "ACTIVE";
            const availLabel = !s.canTransferNow && eligibleAt ? `disponível em ${fmtDate(eligibleAt, "dd/MM")}` : null;
            return (
              <Card key={s.userId}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <Avatar uri={s.avatarUrl} name={s.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600" }} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text variant="small" tone="muted" numberOfLines={1}>
                      {[atUser(s.username), `desde ${fmtDate(s.since)}`].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap", alignItems: "center" }}>
                  <Button title="Remover" size="sm" variant="secondary" icon="person-remove-outline" onPress={() => confirmRemove(s)} />
                  <Button title="Transferir propriedade" size="sm" variant="outline" icon="swap-horizontal-outline" disabled={!canTransfer} onPress={() => setTransferTo(s)} accessibilityLabel={availLabel ? `Transferir propriedade, ${availLabel}` : "Transferir propriedade"} />
                  {availLabel ? <Badge label={availLabel} tone="neutral" icon="time-outline" /> : null}
                </View>
              </Card>
            );
          })
        )}
        {ownerLocked ? (
          <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
            Você recebeu a propriedade recentemente: poderá transferi-la de novo a partir de {fmtDate(ownerLocked)}.
          </Text>
        ) : null}
      </Section>

      <TransferSheet pet={pet} share={transferTo} onClose={() => setTransferTo(null)} />
    </View>
  );
}

/** Confirmation for the ownership transfer: explains the rules and asks for the password (or an e-mail code). */
function TransferSheet({ pet, share, onClose }: { pet: Pet; share: PetShare | null; onClose: () => void }) {
  const t = useTheme();
  const { user } = useAuth();
  const hasPassword = user?.hasPassword !== false;
  const { transfer, sendTransferCode } = useSharingMutations(pet.id);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setPassword("");
    setCode("");
    setCodeSent(false);
    setError(null);
    onClose();
  };
  const proofOk = hasPassword ? password.length > 0 : /^\d{6}$/.test(code);
  const submit = async () => {
    if (!share) return;
    setError(null);
    try {
      await transfer.mutateAsync({ toUserId: share.userId, ...(hasPassword ? { password } : { code }) });
      close();
      Alert.alert("Solicitação enviada", `${handleOf(share)} precisa aceitar para se tornar o novo tutor principal de ${pet.name}.`);
    } catch (e) {
      setError(transferErrorText(e));
    }
  };

  return (
    <Sheet visible={!!share} onClose={close} title="Transferir propriedade">
      {share ? (
        <>
          <Card style={{ backgroundColor: t.warningSoft }}>
            <Text style={{ fontWeight: "700" }}>
              {handleOf(share)} passará a ser o tutor principal de {pet.name}.
            </Text>
            <Text variant="small" tone="muted" style={{ marginTop: 6 }}>
              • A pessoa precisa aceitar a solicitação. Até lá, você pode cancelar.{"\n"}• Depois de aceita, você vira uma conta compartilhada: continua vendo {pet.name} e marcando tarefas da rotina, mas não altera mais o cadastro.{"\n"}• A transferência só é possível após {TRANSFER_DAYS} dias de compartilhamento, e o novo tutor só poderá transferir de novo depois de outros {TRANSFER_DAYS} dias.
            </Text>
          </Card>
          {hasPassword ? (
            <Input label="Sua senha" secureTextEntry autoComplete="current-password" textContentType="password" value={password} onChangeText={setPassword} />
          ) : (
            <View>
              <Text variant="small" tone="muted">
                Sua conta entra com Google ou Apple. Para confirmar, enviaremos um código ao seu e-mail.
              </Text>
              {codeSent ? <Input label="Código recebido por e-mail" keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" value={code} onChangeText={(v: string) => setCode(v.replace(/\D/g, ""))} /> : null}
              <Button
                title={codeSent ? "Reenviar código" : "Enviar código"}
                variant="secondary"
                loading={sendTransferCode.isPending}
                onPress={() =>
                  sendTransferCode
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
          <Button title="Solicitar transferência" variant="danger" disabled={!proofOk} onPress={() => void submit()} loading={transfer.isPending} style={{ marginTop: spacing.md }} />
        </>
      ) : null}
    </Sheet>
  );
}

function SharedView({ pet, data }: { pet: Pet; data: PetSharing }) {
  const t = useTheme();
  const router = useRouter();
  const { leave } = useSharingMutations(pet.id);
  const me = data.shares[0];
  const confirmLeave = () =>
    Alert.alert("Sair do compartilhamento?", `Você deixará de ver ${pet.name}. Para voltar, ${handleOf(data.owner)} precisará enviar um novo convite.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () =>
          leave
            .mutateAsync()
            .then(() => router.replace("/(tutor)/pets"))
            .catch((e) => Alert.alert("Erro", errorMessage(e))),
      },
    ]);
  return (
    <View>
      <Section title="Tutor principal">
        <ListItem
          title={data.owner.name}
          subtitle={[atUser(data.owner.username), data.ownerSince ? `desde ${fmtDate(data.ownerSince)}` : null].filter(Boolean).join(" · ")}
          left={<Avatar uri={data.owner.avatarUrl} name={data.owner.name} size={44} />}
        />
      </Section>
      <Card style={{ backgroundColor: t.infoSoft }}>
        <Text style={{ fontWeight: "700" }}>Acesso somente leitura</Text>
        <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
          {pet.name} foi compartilhado com você{me?.since ? ` em ${fmtDate(me.since)}` : ""}. Você pode ver a ficha, a galeria, a saúde e o histórico e marcar as tarefas da rotina como feitas. Apenas o tutor principal altera o cadastro.
        </Text>
      </Card>
      <Button title="Sair do compartilhamento" variant="danger" icon="exit-outline" onPress={confirmLeave} loading={leave.isPending} style={{ marginTop: spacing.md }} />
    </View>
  );
}
