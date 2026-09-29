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
  videos_per_day: "vídeos por dia",
  owner_videos_per_day: "vídeos por dia",
  video_max_seconds: "segundos por vídeo",
  owner_video_max_seconds: "segundos por vídeo",
};

const VIDEO_PER_DAY_KEYS = new Set(["videos_per_day", "owner_videos_per_day"]);
const VIDEO_SECONDS_KEYS = new Set(["video_max_seconds", "owner_video_max_seconds"]);

export function isFreePlanKey(planKey?: string | null): boolean {
  return !planKey || planKey === "free" || planKey === "owner_free" || planKey.endsWith("_free");
}

/** Hint shown to free plans on video limits. */
export const VIDEO_UPGRADE_HINT = "Assinantes enviam até 10 vídeos por dia, de até 60 segundos cada.";

/** pt-BR text for the per-plan video limits (daily quota / max duration). Returns null for other features. */
export function videoLimitMessage(featureKey: string | undefined, limit: number | null | undefined, planKey?: string | null): string | null {
  if (!featureKey) return null;
  const upgrade = isFreePlanKey(planKey) ? ` ${VIDEO_UPGRADE_HINT}` : "";
  if (VIDEO_PER_DAY_KEYS.has(featureKey)) {
    if (limit == null) return null;
    if (limit <= 0) return `Seu plano atual não permite envio de vídeos.${upgrade}`;
    return `Seu plano permite ${limit} ${limit === 1 ? "vídeo" : "vídeos"} por dia. Você já atingiu o limite de hoje — tente novamente amanhã.${upgrade}`;
  }
  if (VIDEO_SECONDS_KEYS.has(featureKey)) {
    if (limit == null) return null;
    return `Seu plano permite vídeos de até ${limit} segundos.${upgrade}`;
  }
  return null;
}

export function isPlanLimit(e: unknown): e is ApiError {
  return e instanceof ApiError && e.isPlanLimit;
}

/** Upgrade notice shown when the API answers 402 PLAN_LIMIT. */
export function PlanLimitNotice({ error, compact }: { error: ApiError; compact?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  const d = (error.details ?? {}) as { featureKey?: string; current?: number; limit?: number | null; planKey?: string };
  const feature = FEATURE_LABEL[d.featureKey ?? ""] ?? "este recurso";
  const videoText = videoLimitMessage(d.featureKey, d.limit, d.planKey);
  // limit 0 / null = feature not included (boolean features such as owner_gallery answer limit 0).
  const limitText = videoText ?? (d.limit ? `Seu plano permite até ${d.limit} ${feature}.` : `Seu plano atual não inclui ${feature}.`);
  return (
    <Card style={{ backgroundColor: t.primarySoft, borderColor: t.primary }}>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
        <Ionicons name="sparkles" size={22} color={t.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="h3">Limite do plano atingido</Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            {limitText}
            {videoText ? "" : " Faça upgrade para liberar mais."}
          </Text>
          {!compact ? <Button title="Ver planos" size="sm" style={{ marginTop: spacing.md, alignSelf: "flex-start" }} onPress={() => router.push("/(tutor)/conta/plano")} /> : null}
        </View>
      </View>
    </Card>
  );
}
