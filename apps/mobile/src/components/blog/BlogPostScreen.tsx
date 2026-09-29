import React, { useEffect, useRef } from "react";
import { Alert, Dimensions, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Share, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { blogErrorMessage, sendBlogView, useBlogPost, usePostHeart } from "@/hooks/use-blog";
import { absUrl, blogImageHosts, blogWebUrl, internalBlogSlug, postMeta } from "@/lib/blog";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { BlogPost } from "@/lib/types";
import { Empty, ErrorState, Loading, Text } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { BlogHtml } from "./BlogHtml";
import { CommentsSection } from "./Comments";
import { HeartButton } from "./HeartButton";

function tagsOf(p: BlogPost): string[] {
  if (Array.isArray(p.tags)) return p.tags.filter(Boolean);
  return (p.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Post reader shared by the tutor and partner areas (`basePath` = where the blog routes live). */
export function BlogPostScreen({ slug, basePath }: { slug: string | undefined; basePath: string }) {
  const t = useTheme();
  const router = useRouter();
  const q = useBlogPost(slug);
  const heart = usePostHeart(slug);
  const viewed = useRef<string | null>(null);
  const data = q.data;
  const post = data && "id" in data ? data : null;

  // Old slug → replace with the canonical one.
  useEffect(() => {
    if (data && "redirectTo" in data && data.redirectTo && data.redirectTo !== slug) router.replace(`${basePath}/${data.redirectTo}` as never);
  }, [data, slug, basePath, router]);

  // View beacon: once per open of this screen.
  useEffect(() => {
    if (!post || viewed.current === post.id) return;
    viewed.current = post.id;
    const s = Dimensions.get("screen");
    void sendBlogView(post.id, { width: s.width, height: s.height });
  }, [post]);

  const share = async () => {
    if (!post) return;
    const url = blogWebUrl(post.slug);
    try {
      await Share.share(Platform.OS === "ios" ? { message: post.title, url } : { message: `${post.title}\n${url}`, title: post.title });
    } catch {
      /* dismissed */
    }
  };

  const toggleHeart = () => {
    if (!post) return;
    heart.mutate(post.id, { onError: (e) => Alert.alert("Não foi possível registrar", blogErrorMessage(e)) });
  };

  const onLink = (href: string) => {
    const s = internalBlogSlug(href);
    if (!s) return false;
    router.push(`${basePath}/${s}` as never);
    return true;
  };

  const openCategory = (catSlug: string) => router.push({ pathname: basePath, params: { category: catSlug } } as never);
  const openTag = (tag: string) => router.push({ pathname: basePath, params: { tag } } as never);

  const shareBtn = post ? (
    <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Compartilhar post" hitSlop={10} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={Platform.OS === "ios" ? "share-outline" : "share-social-outline"} size={22} color={t.ink} />
    </Pressable>
  ) : undefined;

  const cover = post ? absUrl(post.coverImageRect ?? post.coverImageSquare) : null;
  const tags = post ? tagsOf(post) : [];
  const notFound = q.error && (q.error as { status?: number }).status === 404;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <BackHeader title={post?.title ?? "Blog"} fallback={basePath} right={shareBtn} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={t.primary} colors={[t.primary]} />}>
        {q.isLoading || (data && "redirectTo" in data) ? <Loading /> : null}
        {notFound ? <Empty icon="newspaper-outline" title="Post não encontrado" description="Ele pode ter sido removido ou ainda não foi publicado." action="Ver o blog" onAction={() => router.replace(basePath as never)} /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {post ? (
          <>
            {cover ? <Image source={{ uri: cover }} style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: t.surfaceAlt }} contentFit="cover" transition={200} accessibilityLabel={post.coverAlt ?? `Capa do post ${post.title}`} accessibilityIgnoresInvertColors /> : null}
            <View style={{ padding: spacing.lg }}>
              {post.categories?.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm }}>
                  {post.categories.map((c) => (
                    <Pressable key={c.slug} onPress={() => openCategory(c.slug)} accessibilityRole="button" accessibilityLabel={`Ver posts de ${c.name}`} style={{ backgroundColor: t.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}>
                      <Text variant="tiny" tone="primary" style={{ fontWeight: "700" }}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Text variant="title" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 32 }}>
                {post.title}
              </Text>
              <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
                {[post.author?.name ? `Por ${post.author.name}` : null, postMeta(post)].filter(Boolean).join(" · ")}
              </Text>
              {post.summary ? (
                <Text style={{ marginTop: spacing.md, fontSize: 17, lineHeight: 25, color: t.inkMuted }}>{post.summary}</Text>
              ) : null}
              <View style={{ height: 1, backgroundColor: t.border, marginVertical: spacing.lg }} />

              <BlogHtml html={post.content} imageHosts={blogImageHosts(post)} onLinkPress={onLink} />

              {tags.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm }}>
                  {tags.map((tg) => (
                    <Pressable key={tg} onPress={() => openTag(tg)} accessibilityRole="button" accessibilityLabel={`Ver posts com a tag ${tg}`} style={{ backgroundColor: t.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}>
                      <Text variant="tiny" tone="muted">
                        #{tg}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: t.border }}>
                <HeartButton hearted={!!post.viewerHearted} count={post.heartsCount ?? 0} onPress={toggleHeart} label="Este post merece um coração" />
                <Text variant="small" tone="muted" style={{ flex: 1 }}>
                  {post.viewerHearted ? "Você deu um coração" : "Gostou? Dê um coração"}
                </Text>
                <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Compartilhar post" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.full, backgroundColor: t.surfaceAlt }}>
                  <Ionicons name="share-social-outline" size={18} color={t.inkMuted} />
                  <Text variant="small" tone="muted" style={{ fontWeight: "600" }}>
                    Compartilhar
                  </Text>
                </Pressable>
              </View>

              <CommentsSection postId={post.id} commentsEnabled={post.commentsEnabled !== false} commentsCount={post.commentsCount} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
