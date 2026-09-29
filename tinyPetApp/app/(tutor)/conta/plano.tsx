import React from "react";
import { View } from "react-native";
import { usePlan } from "@/hooks/use-me";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Card, ErrorState, Loading, Screen, Text } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { planName } from "@/lib/plans";

const LABEL: Record<string, string> = { owner_pets: "Pets", owner_gallery: "Galeria", owner_stories: "Stories", owner_storage_mb: "Armazenamento (MB)", owner_videos_per_day: "Vídeos por dia", owner_video_max_seconds: "Duração máxima do vídeo (s)" };

export default function PlanScreen() {
  const t = useTheme();
  const q = usePlan();
  const limits = q.data ? (Array.isArray(q.data.limits) ? q.data.limits : Object.entries(q.data.limits).map(([featureKey, v]) => ({ featureKey, ...v }))) : [];
  return (
    <>
      <BackHeader title="Meu plano" fallback="/(tutor)/conta" />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {q.data ? (
          <>
            <Card style={{ backgroundColor: t.primarySoft, borderColor: t.primary }}>
              <Text variant="h2">Plano {q.data.planName ?? planName(q.data.planKey)}</Text>
              <Text variant="small" tone="muted">
                Planos pagos liberam galeria, stories e mais pets. Assinatura em breve pelo app; por enquanto, contrate pelo site.
              </Text>
            </Card>
            {limits.map((l) => {
              const used = q.data!.usage?.[l.featureKey] ?? 0;
              const pct = l.quantity ? Math.min(used / l.quantity, 1) : 0;
              return (
                <Card key={l.featureKey}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text variant="h3">{LABEL[l.featureKey] ?? l.featureKey}</Text>
                    <Text variant="small" tone="muted">
                      {!l.enabled ? "Indisponível" : l.quantity == null ? "Ilimitado" : `${used} / ${l.quantity}`}
                    </Text>
                  </View>
                  {l.enabled && l.quantity != null ? (
                    <View style={{ height: 6, backgroundColor: t.surfaceAlt, borderRadius: radius.full, marginTop: spacing.sm, overflow: "hidden" }}>
                      <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: pct >= 1 ? t.danger : t.primary }} />
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </>
        ) : null}
      </Screen>
    </>
  );
}
