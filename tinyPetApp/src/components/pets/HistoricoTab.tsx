import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePetHistory } from "@/hooks/use-pets";
import { fmtDate, fmtDay } from "@/lib/format";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { HistoryEvent } from "@/lib/types";
import { Empty, ErrorState, Loading, Text } from "@/components/ui";
import { openExternal } from "@/lib/links";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = { VISIT: "calendar", VACCINE: "medkit", DEWORMING: "bug", WEIGHT: "scale", ACHIEVEMENT: "trophy", MILESTONE: "flag", SKILL: "school", NOTE: "document-text", ATTACHMENT: "attach", BADGE: "ribbon" };
const LABEL: Record<string, string> = { VISIT: "Atendimento", VACCINE: "Vacina", DEWORMING: "Vermífugo", WEIGHT: "Pesagem", ACHIEVEMENT: "Conquista", MILESTONE: "Marco", SKILL: "Comando", NOTE: "Anotação", ATTACHMENT: "Anexo", BADGE: "Conquista" };

/** Histórico: vertical timeline merging visits, vaccines, weights, badges. */
export function HistoricoTab({ petId }: { petId: string }) {
  const t = useTheme();
  const q = usePetHistory(petId);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const items = q.data ?? [];
  if (items.length === 0) return <Empty icon="time-outline" title="Sem eventos ainda" description="Atendimentos, vacinas e pesagens aparecerão aqui." />;
  return (
    <View>
      {items.map((ev, i) => (
        <TimelineItem key={ev.id ?? i} ev={ev} last={i === items.length - 1} color={t.primary} />
      ))}
    </View>
  );
}

function TimelineItem({ ev, last, color }: { ev: HistoryEvent; last: boolean; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row" }}>
      <View style={{ width: 36, alignItems: "center" }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={ICONS[ev.type] ?? "ellipse"} size={14} color={color} />
        </View>
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: t.border, marginVertical: 2 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingLeft: spacing.sm, paddingBottom: spacing.lg }}>
        <Text variant="tiny" tone="faint">
          {LABEL[ev.type] ?? ev.type} · {fmtDay(ev.occurredAt)}
          {ev.partner ? ` · ${ev.partner.tradeName}` : ""}
        </Text>
        <Text variant="h3">{ev.title}</Text>
        {ev.description ? (
          <Text variant="small" tone="muted" style={{ marginTop: 2 }}>
            {ev.description}
          </Text>
        ) : null}
        {ev.photos?.length ? (
          <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.sm, flexWrap: "wrap" }}>
            {ev.photos.map((p) => (
              <Image key={p} source={{ uri: p }} style={{ width: 72, height: 72, borderRadius: radius.sm, backgroundColor: t.surfaceAlt }} contentFit="cover" />
            ))}
          </View>
        ) : null}
        {ev.attachments?.map((a) => (
          <Pressable key={a.url} onPress={() => openExternal(a.url)} accessibilityRole="link" accessibilityLabel={`Abrir anexo ${a.name}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Ionicons name="document-attach-outline" size={16} color={t.primary} />
            <Text variant="small" tone="primary">
              {a.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
