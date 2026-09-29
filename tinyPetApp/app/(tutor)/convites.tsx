import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useMyPetInvites, usePetInviteActions } from "@/hooks/use-sharing";
import { ApiError, errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { atUser } from "@/lib/username";
import { spacing } from "@/lib/theme";
import type { PetInviteIn } from "@/lib/types";
import { Avatar, Button, Card, Empty, ErrorState, Loading, Screen, Section, Text } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { isPlanLimit, PlanLimitNotice } from "@/components/PlanLimitNotice";

type Kind = "share" | "transfer";

function speciesKeyOf(p: PetInviteIn["pet"]): string | undefined {
  return typeof p.species === "string" ? p.species : (p.species?.key ?? undefined);
}

/** Pending pet share invites and ownership transfer requests addressed to me. */
export default function PetInvitesScreen() {
  const q = useMyPetInvites();
  const [limitErr, setLimitErr] = useState<ApiError | null>(null);
  const shares = q.data?.shares ?? [];
  const transfers = q.data?.transfers ?? [];
  return (
    <>
      <BackHeader title="Convites de pets" fallback="/(tutor)/inicio" />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {limitErr ? <PlanLimitNotice error={limitErr} /> : null}
        {q.data ? (
          shares.length + transfers.length === 0 ? (
            <Empty icon="mail-open-outline" title="Nenhum convite pendente" description="Quando alguém compartilhar um pet ou transferir a propriedade para você, o convite aparece aqui." />
          ) : (
            <>
              {transfers.length ? (
                <Section title="Transferências de propriedade">
                  {transfers.map((it) => (
                    <InviteCard key={it.id} kind="transfer" invite={it} onPlanLimit={setLimitErr} />
                  ))}
                </Section>
              ) : null}
              {shares.length ? (
                <Section title="Compartilhamentos">
                  {shares.map((it) => (
                    <InviteCard key={it.id} kind="share" invite={it} onPlanLimit={setLimitErr} />
                  ))}
                </Section>
              ) : null}
            </>
          )
        ) : null}
      </Screen>
    </>
  );
}

function InviteCard({ kind, invite, onPlanLimit }: { kind: Kind; invite: PetInviteIn; onPlanLimit: (e: ApiError | null) => void }) {
  const router = useRouter();
  const { answerShare, answerTransfer } = usePetInviteActions();
  const m = kind === "share" ? answerShare : answerTransfer;
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const from = atUser(invite.from.username) ?? invite.from.name;

  const answer = async (accept: boolean) => {
    setBusy(accept ? "accept" : "decline");
    onPlanLimit(null);
    try {
      await m.mutateAsync({ id: invite.id, accept });
      if (accept) {
        Alert.alert(kind === "share" ? "Convite aceito" : "Propriedade aceita", kind === "share" ? `${invite.pet.name} agora aparece em Meus pets.` : `Agora você é o tutor principal de ${invite.pet.name}.`, [
          { text: "OK", style: "cancel" },
          { text: "Abrir pet", onPress: () => router.push(`/(tutor)/pets/${invite.pet.id}`) },
        ]);
      }
    } catch (e) {
      if (isPlanLimit(e)) onPlanLimit(e);
      else Alert.alert("Erro", errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const confirmDecline = () =>
    Alert.alert(kind === "share" ? "Recusar convite?" : "Recusar transferência?", undefined, [
      { text: "Voltar", style: "cancel" },
      { text: "Recusar", style: "destructive", onPress: () => void answer(false) },
    ]);
  const confirmAcceptTransfer = () =>
    Alert.alert(
      `Aceitar a propriedade de ${invite.pet.name}?`,
      `Você passa a ser o tutor principal e ${from} vira uma conta compartilhada. Você só poderá transferir a propriedade de novo depois de 7 dias.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Aceitar", onPress: () => void answer(true) },
      ],
    );

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Avatar uri={invite.pet.avatarUrl} name={invite.pet.name} species={speciesKeyOf(invite.pet)} size={52} />
        <View style={{ flex: 1 }}>
          <Text variant="h3" numberOfLines={1}>
            {invite.pet.name}
          </Text>
          <Text variant="small" tone="muted">
            {kind === "share" ? `${from} quer compartilhar ${invite.pet.name} com você.` : `${from} quer transferir a propriedade de ${invite.pet.name} para você.`}
          </Text>
          <Text variant="tiny" tone="faint" style={{ marginTop: 2 }}>
            {[`Recebido em ${fmtDate(invite.createdAt)}`, invite.expiresAt ? `expira em ${fmtDate(invite.expiresAt)}` : null].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </View>
      {kind === "share" ? (
        <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
          Você poderá ver a ficha, a galeria e o histórico e marcar tarefas da rotina como feitas. Pode sair do compartilhamento quando quiser.
        </Text>
      ) : (
        <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
          Ao aceitar, o pet passa a contar no limite de pets do seu plano.
        </Text>
      )}
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        <Button title="Aceitar" size="sm" icon="checkmark" loading={busy === "accept"} disabled={!!busy} onPress={kind === "transfer" ? confirmAcceptTransfer : () => void answer(true)} />
        <Button title="Recusar" size="sm" variant="secondary" loading={busy === "decline"} disabled={!!busy} onPress={confirmDecline} />
      </View>
    </Card>
  );
}
