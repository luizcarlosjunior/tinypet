import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ApiError } from "@/lib/api";
import { spacing, useTheme } from "@/lib/theme";
import { Button, Card, Text } from "@/components/ui";

const FEATURE_LABEL: Record<string, string> = {
  owner_pets: "pets cadastrados",
  owner_gallery: "galeria de fotos",
  owner_stories: "stories",
  owner_storage_mb: "armazenamento",
  crm_clients: "clientes",
  catalog_items: "itens no catálogo",
  active_contracts: "contratos ativos",
  team_members: "membros da equipe",
};

export function isPlanLimit(e: unknown): e is ApiError {
  return e instanceof ApiError && e.isPlanLimit;
}

/** Upgrade notice shown when the API answers 402 PLAN_LIMIT. */
export function PlanLimitNotice({ error, compact }: { error: ApiError; compact?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  const d = (error.details ?? {}) as { featureKey?: string; current?: number; limit?: number | null; planKey?: string };
  const feature = FEATURE_LABEL[d.featureKey ?? ""] ?? "este recurso";
  const limitText = d.limit != null ? `Seu plano ${d.planKey ? `(${d.planKey}) ` : ""}permite até ${d.limit} ${feature}.` : `Seu plano atual não inclui ${feature}.`;
  return (
    <Card style={{ backgroundColor: t.primarySoft, borderColor: t.primary }}>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
        <Ionicons name="sparkles" size={22} color={t.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="h3">Limite do plano atingido</Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            {limitText} Faça upgrade para liberar mais.
          </Text>
          {!compact ? <Button title="Ver planos" size="sm" style={{ marginTop: spacing.md, alignSelf: "flex-start" }} onPress={() => router.push("/(tutor)/conta/plano")} /> : null}
        </View>
      </View>
    </Card>
  );
}
