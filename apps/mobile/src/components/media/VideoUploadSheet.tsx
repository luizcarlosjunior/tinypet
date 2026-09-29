import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ApiError, errorMessage } from "@/lib/api";
import { fetchMediaLimits, uploadProcessedVideo, type MediaLimits, type MediaPurpose, type UploadedMedia, type VideoUploadPhase } from "@/lib/upload";
import {
  cropCover,
  extractDefaultCover,
  isCancelled,
  isVideoTranscoderAvailable,
  prepareCoverSource,
  probeVideo,
  transcodeVideo,
  VideoProcessingError,
  type ProcessedVideo,
  type VideoCover,
  type VideoProbe,
} from "@/lib/video/transcode";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Button, Card, Sheet, Text } from "@/components/ui";
import { isFreePlanKey, isPlanLimit, PlanLimitNotice, VIDEO_UPGRADE_HINT } from "@/components/PlanLimitNotice";
import { ImageCropperModal } from "./ImageCropperModal";
import { VideoPreview } from "./VideoPreview";

type Step =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "idle" }
  | { kind: "tooLong"; uri: string; probe: VideoProbe }
  | { kind: "transcoding"; progress: number }
  | { kind: "review" }
  | { kind: "uploading"; phase: VideoUploadPhase; progress: number };

export type VideoUploadSheetProps = {
  visible: boolean;
  onClose: () => void;
  purpose: MediaPurpose;
  /** X-Partner-Id for limits and upload: partner id in partner context, `null` for tutor (owner) uploads. */
  partnerId: string | null;
  title?: string;
  /** Called after /media/complete succeeded (the sheet does not close itself). */
  onUploaded: (media: UploadedMedia, extra: { coverUri: string; video: ProcessedVideo }) => void;
};

async function deleteQuietly(uri?: string | null) {
  if (!uri) return;
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

function fmtBytes(n: number) {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/**
 * Video upload flow: plan limits → pick (no editing) → [trim to plan max?] → on-device transcode (progress + cancel)
 * → preview → cover (default frame at ~1 s, or "Trocar capa" → pick image → crop to the video aspect) → "Enviar".
 */
export function VideoUploadSheet({ visible, onClose, purpose, partnerId, title = "Enviar vídeo", onUploaded }: VideoUploadSheetProps) {
  const t = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [limits, setLimits] = useState<MediaLimits | null>(null);
  const [planError, setPlanError] = useState<ApiError | null>(null);
  const [video, setVideo] = useState<ProcessedVideo | null>(null);
  const [cover, setCover] = useState<VideoCover | null>(null);
  const [coverIsDefault, setCoverIsDefault] = useState(true);
  const [cropSource, setCropSource] = useState<VideoCover | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const videoRef = useRef<ProcessedVideo | null>(null);
  videoRef.current = video;

  const maxSeconds = limits?.videoMaxSeconds ?? null;
  const remaining = limits?.videosPerDay != null ? Math.max(0, limits.videosPerDay - limits.videosUsedToday) : null;
  const blocked = remaining === 0;
  const aspect = video ? video.width / video.height : 16 / 9;

  const loadLimits = useCallback(async () => {
    setStep({ kind: "loading" });
    setPlanError(null);
    try {
      const l = await fetchMediaLimits(partnerId);
      setLimits(l);
      setStep({ kind: "idle" });
    } catch (e) {
      if (isPlanLimit(e)) {
        setPlanError(e);
        setStep({ kind: "idle" });
      } else setStep({ kind: "error", message: errorMessage(e) });
    }
  }, [partnerId]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    deleteQuietly(videoRef.current?.uri);
    setVideo(null);
    setCover(null);
    setCoverIsDefault(true);
    setCropSource(null);
  }, []);

  useEffect(() => {
    if (visible) loadLimits();
    else reset();
  }, [visible, loadLimits, reset]);

  useEffect(() => () => reset(), [reset]);

  const close = () => {
    if (step.kind === "transcoding" || step.kind === "uploading") {
      Alert.alert("Cancelar envio?", "O processamento do vídeo será interrompido.", [
        { text: "Continuar", style: "cancel" },
        { text: "Cancelar envio", style: "destructive", onPress: () => { reset(); onClose(); } },
      ]);
      return;
    }
    reset();
    onClose();
  };

  const runTranscode = async (uri: string, probe: VideoProbe, trimToMax: boolean) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStep({ kind: "transcoding", progress: 0 });
    try {
      const out = await transcodeVideo(uri, {
        probe,
        maxDurationSeconds: maxSeconds,
        trimToMax,
        signal: ctrl.signal,
        onProgress: (p) => setStep((s) => (s.kind === "transcoding" ? { kind: "transcoding", progress: p } : s)),
      });
      if (ctrl.signal.aborted) {
        deleteQuietly(out.uri);
        return;
      }
      setVideo(out);
      try {
        setCover(await extractDefaultCover(out));
        setCoverIsDefault(true);
      } catch {
        setCover(null);
      }
      setStep({ kind: "review" });
    } catch (e) {
      if (isCancelled(e)) setStep({ kind: "idle" });
      else {
        setStep({ kind: "idle" });
        Alert.alert("Não foi possível processar o vídeo", e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  };

  const pick = async (camera: boolean) => {
    if (!isVideoTranscoderAvailable()) {
      Alert.alert("Atualize o app", "O envio de vídeos exige a versão mais recente do aplicativo.");
      return;
    }
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permissão necessária", camera ? "Permita o acesso à câmera nas configurações." : "Permita o acesso às fotos nas configurações.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: 1,
      ...(maxSeconds ? { videoMaxDuration: maxSeconds } : {}),
      // iOS: skip the picker's own (slow) H.264 export; our transcoder reads HEVC directly.
      ...(Platform.OS === "ios" ? { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current } : {}),
    };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    let probe: VideoProbe;
    try {
      probe = await probeVideo(asset.uri);
    } catch (e) {
      Alert.alert("Vídeo inválido", e instanceof Error ? e.message : String(e));
      return;
    }
    if (maxSeconds && probe.durationSeconds > maxSeconds + 0.05) {
      setStep({ kind: "tooLong", uri: asset.uri, probe });
      return;
    }
    await runTranscode(asset.uri, probe, false);
  };

  const cancelProcessing = () => {
    abortRef.current?.abort();
  };

  const changeCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permissão necessária", "Permita o acesso às fotos nas configurações.");
      return;
    }
    // No `allowsEditing`: on iOS it ignores `aspect` (always square). We crop in our own UI.
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1, exif: false });
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    try {
      setCropSource(await prepareCoverSource(asset.uri));
    } catch (e) {
      Alert.alert("Imagem inválida", errorMessage(e));
    }
  };

  const applyCrop = async (rect: { originX: number; originY: number; width: number; height: number }) => {
    if (!cropSource || !video) return;
    try {
      const next = await cropCover(cropSource, rect, video.orientation);
      if (cover && cover.uri !== next.uri) deleteQuietly(cover.uri);
      setCover(next);
      setCoverIsDefault(false);
    } catch (e) {
      Alert.alert("Erro ao recortar", errorMessage(e));
    } finally {
      setCropSource(null);
    }
  };

  const useDefaultCover = async () => {
    if (!video) return;
    try {
      const c = await extractDefaultCover(video);
      if (cover) deleteQuietly(cover.uri);
      setCover(c);
      setCoverIsDefault(true);
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };

  const send = async () => {
    if (!video || !cover) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStep({ kind: "uploading", phase: "cover", progress: 0 });
    try {
      const media = await uploadProcessedVideo(video, cover, purpose, {
        partnerId,
        signal: ctrl.signal,
        onProgress: ({ phase, progress }) => setStep({ kind: "uploading", phase, progress }),
      });
      onUploaded(media, { coverUri: cover.uri, video });
      deleteQuietly(video.uri);
      setVideo(null);
      setLimits((l) => (l ? { ...l, videosUsedToday: l.videosUsedToday + 1 } : l));
      setStep({ kind: "idle" });
    } catch (e) {
      setStep({ kind: "review" });
      if (isCancelled(e)) return;
      if (isPlanLimit(e)) setPlanError(e);
      else Alert.alert("Erro no envio", e instanceof VideoProcessingError ? e.message : errorMessage(e));
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  };

  const discard = () => {
    reset();
    setStep({ kind: "idle" });
  };

  const isFree = isFreePlanKey(limits?.planKey);
  const limitsLine = limits
    ? [
        remaining != null ? `Hoje você ainda pode enviar ${remaining} de ${limits.videosPerDay} ${limits.videosPerDay === 1 ? "vídeo" : "vídeos"}.` : "Envios de vídeo ilimitados hoje.",
        maxSeconds ? `Duração máxima: ${maxSeconds} segundos.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <Sheet visible={visible} onClose={close} title={title}>
      {planError ? (
        <View style={{ marginBottom: spacing.md }}>
          <PlanLimitNotice error={planError} />
        </View>
      ) : null}

      {step.kind === "loading" ? (
        <Text tone="muted">Verificando o limite do seu plano…</Text>
      ) : step.kind === "error" ? (
        <View style={{ gap: spacing.md }}>
          <Text tone="danger">{step.message}</Text>
          <Button title="Tentar novamente" variant="secondary" onPress={loadLimits} />
        </View>
      ) : step.kind === "idle" ? (
        blocked && limits ? (
          <Card style={{ backgroundColor: t.primarySoft, borderColor: t.primary }}>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Ionicons name="sparkles" size={22} color={t.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="h3">Limite diário de vídeos atingido</Text>
                <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
                  {`Seu plano permite ${limits.videosPerDay} ${limits.videosPerDay === 1 ? "vídeo" : "vídeos"} por dia. Tente novamente amanhã.`}
                  {isFree ? ` ${VIDEO_UPGRADE_HINT}` : ""}
                </Text>
                {isFree && limits.audience === "OWNER" ? <Button title="Ver planos" size="sm" style={{ marginTop: spacing.md, alignSelf: "flex-start" }} onPress={() => { close(); router.push("/(tutor)/conta/plano"); }} /> : null}
              </View>
            </View>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {limitsLine ? (
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                <Ionicons name="information-circle-outline" size={18} color={t.inkMuted} style={{ marginTop: 1 }} />
                <Text variant="small" tone="muted" style={{ flex: 1 }}>
                  {limitsLine}
                  {isFree ? ` ${VIDEO_UPGRADE_HINT}` : ""}
                </Text>
              </View>
            ) : null}
            <Text variant="small" tone="faint">
              O vídeo é convertido no aparelho para MP4 (720p ou 1080p, 16:9 ou 9:16) antes do envio.
            </Text>
            <Button title="Escolher da galeria" icon="images-outline" onPress={() => pick(false)} />
            <Button title="Gravar vídeo" icon="videocam-outline" variant="secondary" onPress={() => pick(true)} />
          </View>
        )
      ) : step.kind === "tooLong" ? (
        <View style={{ gap: spacing.md }}>
          <Text>{`Este vídeo tem ${Math.ceil(step.probe.durationSeconds)} segundos. Seu plano permite vídeos de até ${maxSeconds} segundos.`}</Text>
          {isFree ? (
            <Text variant="small" tone="muted">
              {VIDEO_UPGRADE_HINT}
            </Text>
          ) : null}
          <Button title={`Usar os primeiros ${maxSeconds} segundos`} icon="cut-outline" onPress={() => runTranscode(step.uri, step.probe, true)} />
          <Button title="Escolher outro vídeo" variant="secondary" onPress={() => setStep({ kind: "idle" })} />
          <Button title="Cancelar" variant="ghost" onPress={close} />
        </View>
      ) : step.kind === "transcoding" ? (
        <ProgressBlock label="Convertendo vídeo no aparelho…" progress={step.progress} onCancel={cancelProcessing} />
      ) : video ? (
        <View style={{ gap: spacing.md }}>
          <VideoPreview uri={video.uri} aspect={aspect} />
          <Text variant="small" tone="muted">
            {`${video.width}×${video.height} · ${Math.round(video.durationSeconds)} s · ${fmtBytes(video.sizeBytes)}${video.trimmed ? ` · primeiros ${maxSeconds} s` : ""}`}
          </Text>

          <Text variant="h3">Capa</Text>
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
            {cover ? (
              <Image source={{ uri: cover.uri }} style={{ width: aspect >= 1 ? 160 : 72, aspectRatio: aspect, borderRadius: radius.sm, backgroundColor: t.surfaceAlt }} contentFit="cover" />
            ) : (
              <View style={{ width: 160, aspectRatio: aspect, borderRadius: radius.sm, backgroundColor: t.surfaceAlt }} />
            )}
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Button title="Trocar capa" icon="image-outline" size="sm" variant="secondary" onPress={changeCover} disabled={step.kind === "uploading"} />
              {!coverIsDefault ? <Button title="Usar quadro do vídeo" size="sm" variant="ghost" onPress={useDefaultCover} disabled={step.kind === "uploading"} /> : null}
            </View>
          </View>

          {step.kind === "uploading" ? (
            <ProgressBlock
              label={step.phase === "cover" ? "Enviando capa…" : step.phase === "uploading" ? "Enviando vídeo…" : "Finalizando…"}
              progress={step.phase === "uploading" ? step.progress : null}
              onCancel={cancelProcessing}
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Button title="Enviar" icon="cloud-upload-outline" onPress={send} disabled={!cover || blocked} />
              <Button title="Descartar vídeo" variant="ghost" onPress={discard} />
            </View>
          )}
        </View>
      ) : null}

      <ImageCropperModal
        visible={!!cropSource}
        image={cropSource}
        aspect={aspect}
        title="Recortar capa"
        onCancel={() => setCropSource(null)}
        onConfirm={applyCrop}
      />
    </Sheet>
  );
}

function ProgressBlock({ label, progress, onCancel }: { label: string; progress: number | null; onCancel: () => void }) {
  const t = useTheme();
  const pct = progress == null ? null : Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text>{pct == null ? label : `${label} ${pct}%`}</Text>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: t.surfaceAlt, overflow: "hidden" }}>
        <View style={{ height: 8, width: pct == null ? "100%" : `${pct}%`, backgroundColor: t.primary, opacity: pct == null ? 0.4 : 1 }} />
      </View>
      <Button title="Cancelar" variant="ghost" onPress={onCancel} />
    </View>
  );
}
