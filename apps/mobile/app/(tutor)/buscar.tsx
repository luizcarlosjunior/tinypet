import React, { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { usePartnerSearch } from "@/hooks/use-public";
import { usePartnerTypes } from "@/hooks/use-ref";
import { fmtKm } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { PartnerSummary } from "@/lib/types";
import { Avatar, Badge, Button, Empty, ErrorState, Input, ListItem, Loading, Screen, Text } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";

function typeLabels(p: PartnerSummary): string {
  return (p.types ?? []).map((x) => (typeof x === "string" ? x : x.label)).join(", ");
}

export default function SearchPartners() {
  const t = useTheme();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string | undefined>();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const types = usePartnerTypes();
  const search = usePartnerSearch({ q: q || undefined, type, lat: coords?.lat, lng: coords?.lng, radiusKm: coords ? 25 : undefined });

  const nearMe = async () => {
    if (coords) return setCoords(null);
    setLocating(true);
    setLocError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocError("Permita a localização para buscar perto de você.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setLocError("Não foi possível obter sua localização.");
    } finally {
      setLocating(false);
    }
  };

  const items = search.data?.data ?? [];
  return (
    <>
      <BackHeader title="Encontrar parceiros" fallback="/(tutor)/inicio" />
      <Screen scroll={false}>
        <Input placeholder="Buscar por nome, serviço…" value={q} onChangeText={setQ} returnKeyType="search" accessibilityLabel="Buscar parceiros" right={<Ionicons name="search" size={18} color={t.inkFaint} />} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md }}>
          <Button title={coords ? "Perto de mim ✓" : "Perto de mim"} size="sm" variant={coords ? "primary" : "outline"} icon="locate" onPress={nearMe} loading={locating} />
          {(types.data ?? []).map((tp) => (
            <Button key={tp.key} title={tp.label} size="sm" variant={type === tp.key ? "primary" : "outline"} onPress={() => setType(type === tp.key ? undefined : tp.key)} />
          ))}
        </View>
        {locError ? (
          <Text variant="small" tone="danger" style={{ marginBottom: spacing.sm }}>
            {locError}
          </Text>
        ) : null}
        {search.isLoading ? <Loading /> : null}
        {search.error ? <ErrorState error={search.error} onRetry={search.refetch} /> : null}
        {search.data ? (
          <FlatList
            data={items}
            keyExtractor={(p) => p.id}
            refreshControl={<RefreshControl refreshing={search.isFetching && !search.isLoading} onRefresh={search.refetch} tintColor={t.primary} colors={[t.primary]} />}
            contentContainerStyle={{ paddingBottom: spacing.xxl }}
            ListEmptyComponent={<Empty icon="storefront-outline" title="Nenhum parceiro encontrado" description="Tente outra busca ou amplie a região." />}
            renderItem={({ item: p }) => (
              <ListItem
                title={p.tradeName}
                subtitle={[typeLabels(p), [p.city, p.state].filter(Boolean).join(" - "), p.distanceKm != null ? fmtKm(p.distanceKm) : null].filter(Boolean).join(" · ")}
                left={<Avatar uri={p.logoUrl} name={p.tradeName} size={48} square />}
                right={
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {p.ratingAvg != null && p.ratingCount ? <Badge label={`${Number(p.ratingAvg).toFixed(1).replace(".", ",")} (${p.ratingCount})`} tone="warning" icon="star" /> : null}
                    {p.featured ? <Badge label="Destaque" tone="primary" /> : null}
                  </View>
                }
                onPress={() => router.push(`/(tutor)/p/${p.slug}`)}
                accessibilityLabel={`Abrir ${p.tradeName}`}
              />
            )}
          />
        ) : null}
      </Screen>
    </>
  );
}
