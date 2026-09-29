import React, { useState } from "react";
import { Alert, Dimensions, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { usePetMedia, usePetMediaMutations } from "@/hooks/use-pets";
import { usePlan } from "@/hooks/use-me";
import { ApiError, errorMessage } from "@/lib/api";
import { pickAndUpload } from "@/lib/upload";
import { fmtDate } from "@/lib/format";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { PetMedia } from "@/lib/types";
import { Button, Empty, ErrorState, Input, Loading, Select, Sheet, Text } from "@/components/ui";
import { isPlanLimit, PlanLimitNotice } from "@/components/PlanLimitNotice";
import { VideoUploadSheet } from "@/components/media/VideoUploadSheet";
import { VideoPreview } from "@/components/media/VideoPreview";

const GAP = 3;
const COLS = 3;

/** Galeria: stories row (24h) + 3-column grid; locked state when the plan blocks gallery (402). */
export function GaleriaTab({ petId, canEdit }: { petId: string; canEdit: boolean }) {
  const t = useTheme();
  const feed = usePetMedia(petId, false);
  const stories = usePetMedia(petId, true);
  const { create, remove } = usePetMediaMutations(petId);
  const plan = usePlan();
  const [busy, setBusy] = useState(false);
  const [limitErr, setLimitErr] = useState<ApiError | null>(null);
  const [selected, setSelected] = useState<PetMedia | null>(null);
  const [composer, setComposer] = useState<{ url: string; thumbUrl?: string | null; kind: "IMAGE" | "VIDEO"; sizeBytes: number; localCover?: string } | null>(null);
  const [videoSheet, setVideoSheet] = useState<{ story: boolean } | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<PetMedia["visibility"]>("PRIVATE");
  const [isStory, setIsStory] = useState(false);

  const width = Dimensions.get("window").width - spacing.lg * 2;
  const cell = (width - GAP * (COLS - 1)) / COLS;

  /**
   * POST /media/upload checks the uploader's own OWNER plan (owner_gallery / owner_stories): check it up front so a
   * free plan sees the upgrade notice instead of transcoding a video that the API will then refuse.
   */
  const planBlock = (story: boolean): ApiError | null => {
    const limits = plan.data?.limits;
    if (!limits || Array.isArray(limits)) return null;
    const key = limits.owner_gallery?.enabled === false ? "owner_gallery" : story && limits.owner_stories?.enabled === false ? "owner_stories" : null;
    return key ? new ApiError(402, "PLAN_LIMIT", "Recurso não incluído no plano", { featureKey: key, current: 0, limit: 0, planKey: plan.data?.planKey }) : null;
  };

  const choose = (story: boolean) => {
    const blocked = planBlock(story);
    if (blocked) {
      setLimitErr(blocked);
      return;
    }
    Alert.alert(story ? "Novo story" : "Adicionar à galeria", undefined, [
      { text: "Foto", onPress: () => add(story) },
      { text: "Vídeo", onPress: () => setVideoSheet({ story }) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const add = async (story: boolean) => {
    setBusy(true);
    try {
      const up = await pickAndUpload("PET_GALLERY");
      if (!up) return;
      setComposer({ url: up.url, thumbUrl: up.thumbUrl, kind: up.kind, sizeBytes: up.sizeBytes });
      setIsStory(story);
      setTitle("");
      setDescription("");
    } catch (e) {
      if (isPlanLimit(e)) setLimitErr(e);
      else Alert.alert("Erro no envio", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!composer) return;
    const { localCover: _localCover, ...media } = composer;
    try {
      await create.mutateAsync({ ...media, title: title || null, description: description || null, takenAt: new Date().toISOString(), isStory, visibility });
      setComposer(null);
    } catch (e) {
      if (isPlanLimit(e)) {
        setLimitErr(e);
        setComposer(null);
      } else Alert.alert("Erro", errorMessage(e));
    }
  };

  if (feed.isLoading) return <Loading />;
  if (feed.error) {
    if (isPlanLimit(feed.error)) return <LockedGallery error={feed.error} />;
    return <ErrorState error={feed.error} onRetry={feed.refetch} />;
  }
  const items = feed.data ?? [];
  const storyItems = stories.data ?? [];

  return (
    <View>
      {limitErr ? <PlanLimitNotice error={limitErr} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}>
        {canEdit ? (
          <Pressable onPress={() => choose(true)} accessibilityRole="button" accessibilityLabel="Adicionar story" disabled={busy} style={{ alignItems: "center" }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderStyle: "dashed", borderColor: t.primary, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="add" size={26} color={t.primary} />
            </View>
            <Text variant="tiny" tone="muted" style={{ marginTop: 4 }}>
              Story
            </Text>
          </Pressable>
        ) : null}
        {storyItems.map((s) => (
          <Pressable key={s.id} onPress={() => setSelected(s)} accessibilityRole="imagebutton" accessibilityLabel={s.title ?? "Story"} style={{ alignItems: "center" }}>
            <View style={{ padding: 2, borderRadius: 34, borderWidth: 2, borderColor: t.primary }}>
              <Image source={{ uri: s.thumbUrl ?? s.url }} style={{ width: 60, height: 60, borderRadius: 30 }} contentFit="cover" />
            </View>
            <Text variant="tiny" tone="muted" style={{ marginTop: 4 }}>
              {fmtDate(s.takenAt, "HH:mm")}
            </Text>
          </Pressable>
        ))}
        {storyItems.length === 0 && !canEdit ? (
          <Text variant="small" tone="faint">
            Sem stories nas últimas 24h
          </Text>
        ) : null}
      </ScrollView>

      {canEdit ? <Button title="Adicionar foto ou vídeo" icon="images-outline" onPress={() => choose(false)} loading={busy} style={{ marginVertical: spacing.sm }} /> : null}

      {items.length === 0 ? (
        <Empty icon="images-outline" title="Galeria vazia" description="Fotos até 10 MB. Vídeos são convertidos no aparelho (MP4 720p/1080p, 16:9 ou 9:16)." />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {items.map((m) => (
            <Pressable key={m.id} onPress={() => setSelected(m)} accessibilityRole="imagebutton" accessibilityLabel={m.title ?? "Item da galeria"}>
              <Image source={{ uri: m.thumbUrl ?? m.url }} style={{ width: cell, height: cell, backgroundColor: t.surfaceAlt }} contentFit="cover" />
              {m.kind === "VIDEO" ? <Ionicons name="play-circle" size={22} color="#fff" style={{ position: "absolute", right: 6, top: 6 }} /> : null}
            </Pressable>
          ))}
        </View>
      )}

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? (selected?.isStory ? "Story" : "Foto")}>
        {selected ? (
          <View>
            {selected.kind === "VIDEO" ? (
              <VideoPreview uri={selected.url} aspect={selected.width && selected.height ? selected.width / selected.height : 16 / 9} />
            ) : (
              <Image source={{ uri: selected.url }} style={{ width: "100%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: t.surfaceAlt }} contentFit="contain" />
            )}
            <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
              {fmtDate(selected.takenAt, "dd/MM/yyyy HH:mm")} · {visibilityLabel(selected.visibility)}
            </Text>
            {selected.description ? <Text style={{ marginTop: 4 }}>{selected.description}</Text> : null}
            {selected.notes ? (
              <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
                {selected.notes}
              </Text>
            ) : null}
            {canEdit ? (
              <Button
                title="Excluir"
                variant="danger"
                size="sm"
                style={{ marginTop: spacing.md, alignSelf: "flex-start" }}
                onPress={() =>
                  Alert.alert("Excluir item?", "Esta ação não pode ser desfeita.", [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Excluir", style: "destructive", onPress: () => remove.mutateAsync(selected.id).then(() => setSelected(null)).catch((e) => Alert.alert("Erro", errorMessage(e))) },
                  ])
                }
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={!!composer} onClose={() => setComposer(null)} title={isStory ? "Novo story" : "Nova publicação"}>
        {composer ? <Image source={{ uri: composer.thumbUrl ?? composer.localCover ?? composer.url }} style={{ width: "100%", height: 180, borderRadius: radius.md, marginBottom: spacing.md }} contentFit="cover" /> : null}
        {!isStory ? <Input label="Título" value={title} onChangeText={setTitle} /> : null}
        <Input label="Descrição" multiline value={description} onChangeText={setDescription} />
        <Select label="Visibilidade" value={visibility} onChange={(v) => setVisibility((v ?? "PRIVATE") as PetMedia["visibility"])} options={[{ value: "PRIVATE", label: "Privado" }, { value: "FAMILY", label: "Família" }, { value: "PARTNERS", label: "Parceiros vinculados" }]} />
        <Button title="Publicar" onPress={publish} loading={create.isPending} />
      </Sheet>

      <VideoUploadSheet
        visible={!!videoSheet}
        onClose={() => setVideoSheet(null)}
        purpose="PET_GALLERY"
        partnerId={null}
        title={videoSheet?.story ? "Story em vídeo" : "Enviar vídeo"}
        onUploaded={(up, { coverUri }) => {
          const story = !!videoSheet?.story;
          setVideoSheet(null);
          setComposer({ url: up.url, thumbUrl: up.thumbUrl, kind: up.kind, sizeBytes: up.sizeBytes, localCover: coverUri });
          setIsStory(story);
          setTitle("");
          setDescription("");
        }}
      />
    </View>
  );
}

function visibilityLabel(v: PetMedia["visibility"]) {
  return { PRIVATE: "Privado", FAMILY: "Família", PARTNERS: "Parceiros", PUBLIC: "Público" }[v] ?? v;
}

function LockedGallery({ error }: { error: ApiError }) {
  const t = useTheme();
  return (
    <View>
      <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
        <Ionicons name="lock-closed" size={36} color={t.inkFaint} />
        <Text variant="h3" style={{ marginTop: spacing.sm }}>
          Galeria bloqueada no plano Free
        </Text>
        <Text variant="small" tone="muted" style={{ textAlign: "center", marginTop: 4 }}>
          No plano gratuito você pode enviar apenas o avatar do pet.
        </Text>
      </View>
      <PlanLimitNotice error={error} />
    </View>
  );
}
