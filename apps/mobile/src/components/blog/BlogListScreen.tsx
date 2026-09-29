import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBlogCategories, useBlogPosts } from "@/hooks/use-blog";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { BlogCategory } from "@/lib/types";
import { Empty, ErrorState, Input, Loading, Screen, Text } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { PostCard } from "./PostCard";

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Categoria ${label}`} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: active ? t.primary : t.surfaceAlt }}>
      <Text variant="small" style={{ fontWeight: "600", color: active ? t.onPrimary : t.inkMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}

function findCategory(tree: BlogCategory[], slug: string | undefined): { cat: BlogCategory; parent: BlogCategory | null } | null {
  if (!slug) return null;
  for (const c of tree) {
    if (c.slug === slug) return { cat: c, parent: null };
    const child = c.children?.find((x) => x.slug === slug);
    if (child) return { cat: child, parent: c };
  }
  return null;
}

/**
 * Blog list shared by the tutor and partner areas. `basePath` is where the blog routes live
 * (e.g. `/(tutor)/blog`); posts open at `${basePath}/<slug>`.
 */
export function BlogListScreen({ basePath, fallback, initialCategory, initialTag }: { basePath: string; fallback: string; initialCategory?: string; initialTag?: string }) {
  const t = useTheme();
  const router = useRouter();
  const [category, setCategory] = useState<string | undefined>(initialCategory);
  const [tag, setTag] = useState<string | undefined>(initialTag);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => setCategory(initialCategory), [initialCategory]);
  useEffect(() => setTag(initialTag), [initialTag]);
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const cats = useBlogCategories();
  const tree = cats.data ?? [];
  const selected = useMemo(() => findCategory(tree, category), [tree, category]);
  const topSlug = selected ? (selected.parent ?? selected.cat).slug : undefined;
  const top = tree.find((c) => c.slug === topSlug);

  const posts = useBlogPosts({ category, tag, q: q || undefined });
  const items = (posts.data?.pages ?? []).flatMap((p) => p.data ?? []);

  const header = (
    <View>
      <Input
        placeholder="Buscar no blog…"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel="Buscar no blog"
        right={search ? (
          <Pressable onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Limpar busca" hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={t.inkFaint} />
          </Pressable>
        ) : (
          <Ionicons name="search" size={18} color={t.inkFaint} />
        )}
      />
      {tree.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
          <Chip label="Todos" active={!category} onPress={() => setCategory(undefined)} />
          {tree.map((c) => (
            <Chip key={c.id} label={c.name} active={topSlug === c.slug} onPress={() => setCategory(topSlug === c.slug && !selected?.parent ? undefined : c.slug)} />
          ))}
        </ScrollView>
      ) : null}
      {top?.children?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
          <Chip label={`Tudo em ${top.name}`} active={category === top.slug} onPress={() => setCategory(top.slug)} />
          {top.children.map((c) => (
            <Chip key={c.id} label={c.name} active={category === c.slug} onPress={() => setCategory(category === c.slug ? top.slug : c.slug)} />
          ))}
        </ScrollView>
      ) : null}
      {tag ? (
        <View style={{ flexDirection: "row", marginBottom: spacing.sm }}>
          <Pressable onPress={() => setTag(undefined)} accessibilityRole="button" accessibilityLabel={`Remover filtro de tag ${tag}`} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: t.primarySoft }}>
            <Text variant="small" tone="primary" style={{ fontWeight: "600" }}>
              #{tag}
            </Text>
            <Ionicons name="close" size={14} color={t.primary} />
          </Pressable>
        </View>
      ) : null}
      <View style={{ height: spacing.sm }} />
    </View>
  );

  return (
    <>
      <BackHeader title="Blog" fallback={fallback} />
      <Screen scroll={false}>
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={posts.isRefetching && !posts.isFetchingNextPage} onRefresh={() => { void cats.refetch(); void posts.refetch(); }} tintColor={t.primary} colors={[t.primary]} />}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage();
          }}
          ListEmptyComponent={
            posts.isLoading ? (
              <Loading />
            ) : posts.error ? (
              <ErrorState error={posts.error} onRetry={posts.refetch} />
            ) : (
              <Empty icon="newspaper-outline" title={q || category || tag ? "Nenhum post encontrado" : "Nenhum post publicado ainda"} description={q || category || tag ? "Tente outra busca ou categoria." : "Volte em breve para novidades sobre o cuidado com os pets."} />
            )
          }
          ListFooterComponent={posts.isFetchingNextPage ? <ActivityIndicator color={t.primary} style={{ marginVertical: spacing.lg }} /> : null}
          renderItem={({ item }) => <PostCard p={item} onPress={() => router.push(`${basePath}/${item.slug}` as never)} />}
        />
      </Screen>
    </>
  );
}
