import React, { useState } from "react";
import { View } from "react-native";
import { usePet } from "@/hooks/use-pets";
import { petRoleOf, useSharing } from "@/hooks/use-sharing";
import { useAuth } from "@/lib/auth-store";
import { spacing } from "@/lib/theme";
import { ErrorState, Loading, Screen, Tabs } from "@/components/ui";
import { PetHeader } from "./PetHeader";
import { FichaTab } from "./FichaTab";
import { GaleriaTab } from "./GaleriaTab";
import { HistoricoTab } from "./HistoricoTab";
import { SaudeTab } from "./SaudeTab";
import { ComandosTab } from "./ComandosTab";
import { RotinaTab } from "./RotinaTab";
import { AlimentacaoTab } from "./AlimentacaoTab";
import { ConquistasTab } from "./ConquistasTab";
import { CompartilhamentoTab } from "./CompartilhamentoTab";

type TabKey = "ficha" | "galeria" | "historico" | "saude" | "comandos" | "rotina" | "alimentacao" | "conquistas" | "compartilhamento";
const OWNER_TABS: { key: TabKey; label: string }[] = [
  { key: "ficha", label: "Ficha" },
  { key: "galeria", label: "Galeria" },
  { key: "historico", label: "Histórico" },
  { key: "saude", label: "Saúde" },
  { key: "comandos", label: "Comandos" },
  { key: "rotina", label: "Rotina" },
  { key: "alimentacao", label: "Alimentação" },
  { key: "conquistas", label: "Conquistas" },
  { key: "compartilhamento", label: "Compartilhamento" },
];
// Partner view: same screens minus the tutor-only modules.
const PARTNER_TABS = OWNER_TABS.filter((t) => t.key !== "alimentacao" && t.key !== "compartilhamento");

/**
 * Pet detail shared by the tutor area and the partner CRM.
 * mode "owner" (tutor area): full edit rights for the pet owner; a shared account (role "shared") is read-only
 * except ticking routine tasks as done. mode "partner": adds vet/trainer actions.
 */
export function PetDetail({ petId, mode, partnerTypes = [], initialTab = "ficha" }: { petId: string; mode: "owner" | "partner"; partnerTypes?: string[]; initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const q = usePet(petId);
  const { user, activePartnerId } = useAuth();
  const role = mode === "owner" ? petRoleOf(q.data, user?.id) : null;
  // Only needed for the "Compartilhado por @user" header on shared pets (deduped with the Compartilhamento tab).
  const sharing = useSharing(petId, role === "shared");

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error ?? new Error("Pet não encontrado")} onRetry={q.refetch} />;
  const pet = q.data;
  const isOwner = mode === "owner";
  const readOnly = isOwner && role === "shared";
  const canEdit = !readOnly && pet.status === "ACTIVE";
  const canValidate = mode === "partner" && partnerTypes.includes("trainer");
  // API (canEditPetProfile): a partner may edit the profile only of pets it created that have no owner yet.
  const partnerOwnsProfile = mode === "partner" && pet.status === "ACTIVE" && !pet.ownerId && !!activePartnerId && pet.createdByPartnerId === activePartnerId;

  return (
    <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
      <PetHeader pet={pet} sharedBy={readOnly ? (sharing.data?.owner ?? null) : undefined} />
      <Tabs items={isOwner ? OWNER_TABS : PARTNER_TABS} value={tab} onChange={setTab} />
      <View style={{ marginTop: spacing.md }}>
        {tab === "ficha" ? <FichaTab pet={pet} canEdit={mode === "partner" ? partnerOwnsProfile : canEdit} isOwner={isOwner && !readOnly} canRegisterDeath={!readOnly && (mode === "partner" ? !pet.ownerId : isOwner)} /> : null}
        {tab === "galeria" ? <GaleriaTab petId={pet.id} canEdit={canEdit && isOwner} /> : null}
        {tab === "historico" ? <HistoricoTab petId={pet.id} /> : null}
        {tab === "saude" ? <SaudeTab petId={pet.id} canEdit={canEdit || mode === "partner"} /> : null}
        {tab === "comandos" ? <ComandosTab petId={pet.id} canEdit={canEdit || mode === "partner"} canValidate={canValidate} /> : null}
        {tab === "rotina" ? <RotinaTab petId={pet.id} canEdit={canEdit || mode === "partner"} isOwner={isOwner && !readOnly} canComplete={isOwner} partnerMode={mode === "partner"} /> : null}
        {tab === "alimentacao" && isOwner ? <AlimentacaoTab petId={pet.id} canEdit={canEdit} /> : null}
        {tab === "conquistas" ? <ConquistasTab petId={pet.id} /> : null}
        {tab === "compartilhamento" && isOwner ? <CompartilhamentoTab pet={pet} /> : null}
      </View>
    </Screen>
  );
}
