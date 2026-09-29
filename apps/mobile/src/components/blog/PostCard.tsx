import React from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { absUrl, postMeta } from "@/lib/blog";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { BlogPostSummary } from "@/lib/types";
import { Text } from "@/components/ui";

function Counters({ p }: { p: BlogPostSummary }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }} accessibilityLabel={`${p.heartsCount ?? 0} corações`}>
        <Ionicons name="heart-outline" size={13} color={t.inkFaint} />
        <Text variant="tiny" tone="faint">{p.heartsCount ?? 0}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }} accessibilityLabel={`${p.commentsCount ?? 0} comentários`}>
        <Ionicons name="chatbubble-outline" size={13} color={t.inkFaint} />
        <Text variant="tiny" tone="faint">{p.commentsCount ?? 0}</Text>
      </View>
    </View>
  );
}

/** Large card (cover 16:9 + title + summary) for the blog list. */
export function PostCard({ p, onPress }: { p: BlogPostSummary; onPress: () => void }) {
  const t = useTheme();
  const cover = absUrl(p.coverImageRect ?? p.coverImageSquare);
  const cats = (p.categories ?? []).map((c) => c.name).join(" · ");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Ler post: ${p.title}`} style={({ pressed }) => ({ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.md, opacity: pressed ? 0.85 : 1 })}>
      {cover ? <Image source={{ uri: cover }} style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: t.surfaceAlt }} contentFit="cover" transition={150} accessibilityLabel={p.coverAlt ?? undefined} accessibilityIgnoresInvertColors /> : null}
      <View style={{ padding: spacing.lg, gap: 6 }}>
        {cats ? (
          <Text variant="tiny" tone="primary" style={{ textTransform: "uppercase", letterSpacing: 0.5 }} numberOfLines={1}>
            {cats}
          </Text>
        ) : null}
        <Text variant="h2" numberOfLines={3}>
          {p.title}
        </Text>
        {p.summary ? (
          <Text variant="small" tone="muted" numberOfLines={3}>
            {p.summary}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <Text variant="tiny" tone="faint" style={{ flex: 1 }} numberOfLines={1}>
            {postMeta(p)}
          </Text>
          <Counters p={p} />
        </View>
      </View>
    </Pressable>
  );
}

/** Compact row (thumbnail + title + meta) for the home "Do blog" section. */
export function PostRow({ p, onPress }: { p: BlogPostSummary; onPress: () => void }) {
  const t = useTheme();
  const thumb = absUrl(p.coverImageSquare ?? p.coverImageRect);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Ler post: ${p.title}`} style={({ pressed }) => ({ flexDirection: "row", gap: spacing.md, alignItems: "center", paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 })}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: t.surfaceAlt }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="newspaper-outline" size={26} color={t.primary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h3" numberOfLines={2}>
          {p.title}
        </Text>
        <Text variant="tiny" tone="faint" numberOfLines={1}>
          {postMeta(p)}
        </Text>
      </View>
    </Pressable>
  );
}
