import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { formatBRL, LOCATION_TYPE_LABEL } from "@tinypet/shared";
import { usePublicItem, useSubmitReview } from "@/hooks/use-public";
import { errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Badge, Button, Card, ErrorState, Input, Loading, Screen, Section, Sheet, Text } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { ReviewRow, Stars } from "@/components/Reviews";

export default function ItemPage() {
  const t = useTheme();
  const router = useRouter();
  const { id, review } = useLocalSearchParams<{ id: string; review?: string }>();
  const q = usePublicItem(id);
  const submit = useSubmitReview();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  useEffect(() => {
    if (review === "1") setOpen(true);
  }, [review]);
  const it = q.data;

  const send = async () => {
    try {
      await submit.mutateAsync({ itemId: id, rating, comment: comment || null });
      setOpen(false);
      Alert.alert("Obrigado!", "Sua avaliação foi publicada.");
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };

  return (
    <>
      <BackHeader title={it?.name ?? "Item"} fallback="/(tutor)/buscar" />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {it ? (
          <>
            {it.media?.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} pagingEnabled contentContainerStyle={{ gap: 6, marginBottom: spacing.md }}>
                {it.media.map((m, i) => (
                  <Image key={i} source={{ uri: m.thumbUrl ?? m.url }} style={{ width: 280, height: 200, borderRadius: radius.lg, backgroundColor: t.surfaceAlt }} contentFit="cover" />
                ))}
              </ScrollView>
            ) : null}
            <Text variant="title">{it.name}</Text>
            {it.partner ? (
              <Pressable onPress={() => router.push(`/(tutor)/p/${it.partner!.slug}`)} accessibilityRole="link">
                <Text tone="primary">{it.partner.tradeName}</Text>
              </Pressable>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.sm }}>
              <Text variant="h2" style={{ color: t.primary }}>
                {formatBRL(it.promoPrice ?? it.price)}
              </Text>
              {it.promoPrice != null && it.price != null ? (
                <Text variant="small" tone="faint" style={{ textDecorationLine: "line-through" }}>
                  {formatBRL(it.price)}
                </Text>
              ) : null}
              {it.promoUntil ? <Badge label={`Promoção até ${fmtDate(it.promoUntil)}`} tone="primary" /> : null}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md }}>
              <Badge label={it.type === "SERVICE" ? "Serviço" : "Produto"} />
              {it.durationMinutes ? <Badge label={`${it.durationMinutes} min`} icon="time-outline" /> : null}
              {(it.serviceLocations ?? []).map((l) => (
                <Badge key={l} label={LOCATION_TYPE_LABEL[l]} icon="location-outline" />
              ))}
            </View>
            {it.description ? <Text style={{ marginBottom: spacing.md }}>{it.description}</Text> : null}
            {it.bookable && it.partner?.slug ? <Button title="Agendar" size="lg" icon="calendar" onPress={() => router.push(`/(tutor)/agendar/${it.partner!.slug}/${it.id}`)} /> : null}

            <Section title="Avaliações" right={<Button title="Avaliar" size="sm" variant="secondary" onPress={() => setOpen(true)} />} style={{ marginTop: spacing.xl }}>
              {it.ratingAvg != null && it.ratingCount ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm }}>
                  <Stars value={Number(it.ratingAvg)} size={18} />
                  <Text variant="small" tone="muted">
                    {Number(it.ratingAvg).toFixed(1).replace(".", ",")} · {it.ratingCount} {it.ratingCount === 1 ? "avaliação" : "avaliações"}
                  </Text>
                </View>
              ) : (
                <Text variant="small" tone="muted">
                  Seja o primeiro a avaliar.
                </Text>
              )}
              {((it as { reviews?: Parameters<typeof ReviewRow>[0]["r"][] }).reviews ?? []).map((r) => (
                <ReviewRow key={r.id} r={r} />
              ))}
            </Section>
          </>
        ) : null}
      </Screen>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Avaliar">
        <Card>
          <Text variant="small" tone="muted" style={{ marginBottom: 6 }}>
            Sua nota
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => setRating(i)} accessibilityRole="radio" accessibilityState={{ selected: i === rating }} accessibilityLabel={`${i} estrelas`} hitSlop={6}>
                <Ionicons name={i <= rating ? "star" : "star-outline"} size={32} color={t.warning} />
              </Pressable>
            ))}
          </View>
        </Card>
        <Input label="Comentário (opcional)" multiline value={comment} onChangeText={setComment} maxLength={2000} />
        <Text variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
          Avaliações de quem teve atendimento concluído recebem o selo de cliente verificado.
        </Text>
        <Button title="Publicar avaliação" onPress={send} loading={submit.isPending} />
      </Sheet>
    </>
  );
}
