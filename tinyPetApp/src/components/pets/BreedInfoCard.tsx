import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Card, Text } from "@/components/ui";

type Range = { min: number; max: number };
type Trait = { key: string; label: string; value: number; low: string; high: string };
type BreedInfo = { externalName: string; imageUrl: string | null; lifeYears: Range | null; weightKg: { male?: Range | null; female?: Range | null; any?: Range | null }; heightCm: { male?: Range | null; female?: Range | null } | null; origin: string | null; traits: Trait[] };

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const r = (x: Range | null | undefined, unit: string) => (x ? (x.min === x.max ? `${fmt(x.min)} ${unit}` : `${fmt(x.min)}–${fmt(x.max)} ${unit}`) : null);

/** "Sobre a raça" (dogs/cats): typical facts replicated from API Ninjas; hidden when unknown. */
export function BreedInfoCard({ breedId, breedName }: { breedId?: string | null; breedName?: string | null }) {
  const t = useTheme();
  const q = useQuery({ queryKey: ["breed-info", breedId], queryFn: () => api<BreedInfo | null>(`/ref/breeds/${breedId}/info`), enabled: !!breedId, staleTime: 24 * 3_600_000, retry: false });
  const info = q.data;
  if (!breedId || !info) return null;
  const weight = info.weightKg.any !== undefined ? r(info.weightKg.any, "kg") : [info.weightKg.male && `machos ${r(info.weightKg.male, "kg")}`, info.weightKg.female && `fêmeas ${r(info.weightKg.female, "kg")}`].filter(Boolean).join(" · ");
  const height = info.heightCm ? [info.heightCm.male && `machos ${r(info.heightCm.male, "cm")}`, info.heightCm.female && `fêmeas ${r(info.heightCm.female, "cm")}`].filter(Boolean).join(" · ") : null;
  const facts = [["Expectativa de vida", r(info.lifeYears, "anos")], ["Peso típico", weight], ["Altura típica", height], ["Origem", info.origin]].filter(([, v]) => v) as [string, string][];
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        {info.imageUrl ? <Image source={{ uri: info.imageUrl }} style={{ width: 72, height: 72, borderRadius: radius.md }} contentFit="cover" accessibilityLabel={`Foto ilustrativa da raça ${breedName ?? info.externalName}`} /> : null}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="paw-outline" size={16} color={t.ink} />
            <Text variant="h3">Sobre a raça {breedName ?? info.externalName}</Text>
          </View>
          {facts.map(([k, v]) => (
            <Text key={k} variant="small" style={{ marginTop: 4 }}>
              <Text variant="small" tone="muted">
                {k}:{" "}
              </Text>
              {v}
            </Text>
          ))}
        </View>
      </View>
      {info.traits.map((tr) => (
        <View key={tr.key} style={{ marginTop: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="small" style={{ fontWeight: "600" }}>
              {tr.label}
            </Text>
            <Text variant="small" tone="muted">
              {tr.value <= 2 ? tr.low : tr.value >= 4 ? tr.high : "Médio"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 5, now: tr.value }} accessibilityLabel={tr.label}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= tr.value ? t.primary : t.border }} />
            ))}
          </View>
        </View>
      ))}
      <Text variant="tiny" tone="muted" style={{ marginTop: spacing.sm }}>
        Valores típicos da raça — cada pet é único. Dados: API Ninjas.
      </Text>
    </Card>
  );
}
