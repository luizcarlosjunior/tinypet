import React, { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { formatBRL } from "@tinypet/shared";
import { usePublicPartner } from "@/hooks/use-public";
import { useAuth } from "@/lib/auth-store";
import { addressText, linksFor, openRoute } from "@/lib/nav";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { CatalogItem } from "@/lib/types";
import { Avatar, Badge, Button, ErrorState, ListItem, Loading, Screen, Section, Segmented, Text } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { Stars, ReviewRow } from "@/components/Reviews";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function PartnerPage() {
  const t = useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = usePublicPartner(slug);
  const [tab, setTab] = useState<"catalog" | "reviews" | "info">("catalog");
  const p = q.data;
  const items: CatalogItem[] = p?.items ?? p?.catalogItems ?? [];
  const address = p?.address ?? p?.addresses?.find((a) => a.isPrimary) ?? p?.addresses?.[0] ?? null;

  return (
    <>
      <BackHeader title={p?.tradeName ?? "Parceiro"} fallback={token ? "/(tutor)/buscar" : "/(auth)/entrar"} />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {p ? (
          <>
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.md }}>
              <Avatar uri={p.logoUrl} name={p.tradeName} size={64} square />
              <View style={{ flex: 1 }}>
                <Text variant="title">{p.tradeName}</Text>
                <Text variant="small" tone="muted">
                  {(p.types ?? []).map((x) => (typeof x === "string" ? x : x.label)).join(", ")}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  {p.ratingAvg != null ? <Stars value={p.ratingAvg} /> : null}
                  <Text variant="tiny" tone="muted">
                    {p.ratingCount ? `${p.ratingAvg?.toFixed(1)} · ${p.ratingCount} avaliações` : "Sem avaliações"}
                  </Text>
                </View>
              </View>
            </View>
            {p.venuePhotos?.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: spacing.md }}>
                {p.venuePhotos.map((v) => (
                  <Image key={v.id} source={{ uri: v.thumbUrl ?? v.url }} style={{ width: 140, height: 100, borderRadius: radius.md, backgroundColor: t.surfaceAlt }} contentFit="cover" accessibilityLabel={v.caption ?? "Foto do local"} />
                ))}
              </ScrollView>
            ) : null}
            {p.description ? <Text style={{ marginBottom: spacing.md }}>{p.description}</Text> : null}
            <Segmented items={[{ key: "catalog", label: "Catálogo" }, { key: "reviews", label: "Avaliações" }, { key: "info", label: "Informações" }]} value={tab} onChange={setTab} />
            <View style={{ height: spacing.md }} />

            {tab === "catalog" ? (
              items.length === 0 ? (
                <Text tone="muted">Nenhum item publicado.</Text>
              ) : (
                items.map((it) => (
                  <ListItem
                    key={it.id}
                    title={it.name}
                    subtitle={[it.type === "SERVICE" ? "Serviço" : "Produto", it.durationMinutes ? `${it.durationMinutes} min` : null, it.category?.label].filter(Boolean).join(" · ")}
                    left={it.media?.[0] ? <Image source={{ uri: it.media[0].thumbUrl ?? it.media[0].url }} style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: t.surfaceAlt }} contentFit="cover" /> : undefined}
                    right={
                      <View style={{ alignItems: "flex-end" }}>
                        <Text variant="small" style={{ fontWeight: "700", color: it.promoPrice != null ? t.primary : t.ink }}>
                          {formatBRL(it.promoPrice ?? it.price)}
                        </Text>
                        {it.bookable ? <Badge label="Agendável" tone="success" /> : null}
                      </View>
                    }
                    onPress={() => router.push(`/(tutor)/item/${it.id}`)}
                  />
                ))
              )
            ) : null}

            {tab === "reviews" ? ((p.reviews ?? []).length === 0 ? <Text tone="muted">Ainda sem avaliações.</Text> : (p.reviews ?? []).map((r) => <ReviewRow key={r.id} r={r} />)) : null}

            {tab === "info" ? (
              <>
                {address ? (
                  <Section title="Endereço">
                    <Text>{addressText(address)}</Text>
                    <Button title="Como chegar" icon="navigate" size="sm" style={{ marginTop: spacing.sm, alignSelf: "flex-start" }} onPress={() => openRoute(linksFor(address))} />
                  </Section>
                ) : null}
                {p.businessHours?.length ? (
                  <Section title="Horário de funcionamento">
                    {p.businessHours.map((h) => (
                      <View key={h.weekday} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                        <Text variant="small">{WEEKDAYS[h.weekday]}</Text>
                        <Text variant="small" tone="muted">
                          {h.closed ? "Fechado" : `${h.opensAt} – ${h.closesAt}`}
                        </Text>
                      </View>
                    ))}
                  </Section>
                ) : null}
                {p.phones?.length || p.website || p.socialLinks?.length ? (
                  <Section title="Contato">
                    {p.phones?.map((ph) => (
                      <ListItem key={ph.id} title={ph.number} subtitle={ph.type === "WHATSAPP" ? "WhatsApp" : "Telefone"} onPress={() => Linking.openURL(ph.type === "WHATSAPP" ? `https://wa.me/${ph.number.replace(/\D/g, "")}` : `tel:${ph.number}`)} chevron={false} />
                    ))}
                    {p.website ? <ListItem title="Site" subtitle={p.website} onPress={() => Linking.openURL(p.website!)} chevron={false} /> : null}
                    {p.socialLinks?.map((s) => (
                      <ListItem key={s.network} title={s.network.charAt(0) + s.network.slice(1).toLowerCase()} onPress={() => Linking.openURL(s.url)} chevron={false} />
                    ))}
                  </Section>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </Screen>
    </>
  );
}
