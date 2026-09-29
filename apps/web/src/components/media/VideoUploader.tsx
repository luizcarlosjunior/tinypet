"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Crown, Film, ImagePlus, RotateCcw, Upload, X } from "lucide-react";
import { VIDEO_SOURCE_MIME } from "@tinypet/shared";
import { Button } from "@/components/ui";
import { ImageCropper } from "./ImageCropper";
import { fetchMediaLimits, uploadTranscodedVideo, videoDurationMessage, videoQuotaMessage, type MediaLimits, type MediaPurpose, type UploadedMedia, type VideoCoverInput } from "@/lib/upload";
import { captureFrame, cropPreview, defaultCoverTime, extractFrame, formatDuration, formatVideoInfo, isCanceled, maxDurationSeconds, MSG_TOO_BIG, probeVideo, transcodeVideo, trimWindow, videoPlanLimitMessage, type TranscodedVideo, type VideoEngine, type VideoProbe } from "@/lib/video";
import { errorMessage, isPlanLimit, planLimitInfo } from "@/lib/errors";
import { cn } from "@/lib/utils";

export type UploadedVideo = UploadedMedia & { durationSeconds: number };

type Phase = "loading" | "blocked" | "pick" | "probing" | "trim" | "transcoding" | "ready" | "cropping" | "uploading" | "done";
type Cover = { input: VideoCoverInput; previewUrl: string; source: "frame" | "image" };

const ACCEPT = [...VIDEO_SOURCE_MIME, ".mp4", ".m4v", ".mov", ".webm", ".mkv", ".3gp"].join(",");
const EXT_RE = /\.(mp4|m4v|mov|webm|mkv|3gp|3gpp)$/i;

function isAcceptedSource(f: File) {
  return (VIDEO_SOURCE_MIME as readonly string[]).includes(f.type) || EXT_RE.test(f.name) || (f.type.startsWith("video/") && EXT_RE.test(f.name));
}

/**
 * Picks a video, converts it in the browser to VIDEO_OUTPUT (MP4 · H.264 ≤ 1 Mbps · AAC ≤ 128 kbps · 720p/1080p ·
 * 16:9/9:16), lets the user choose/crop a cover and uploads cover + MP4 through the presigned flow.
 * Respects the per-plan video limits (videos/day, max seconds — trimming when needed).
 * Pass `partnerId={null}` for tutor (owner) uploads.
 */
export function VideoUploader({
  purpose,
  partnerId,
  onUploaded,
  onCancel,
  onError,
  initialFile,
  submitLabel = "Enviar vídeo",
  className,
}: {
  purpose: MediaPurpose;
  partnerId?: string | null;
  onUploaded: (m: UploadedVideo) => void | Promise<void>;
  onCancel?: () => void;
  onError?: (e: unknown) => void;
  initialFile?: File | null;
  submitLabel?: string;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [limits, setLimits] = useState<MediaLimits | null>(null);
  const [planError, setPlanError] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<File | null>(null);
  const [probe, setProbe] = useState<VideoProbe | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [engine, setEngine] = useState<VideoEngine | null>(null);
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState<TranscodedVideo | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [cover, setCover] = useState<Cover | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const coverPickRef = useRef<HTMLInputElement>(null);
  const startedInitial = useRef(false);

  // Abort any running job on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);
  // Revoke object URLs when replaced.
  useEffect(() => () => void (videoUrl && URL.revokeObjectURL(videoUrl)), [videoUrl]);
  useEffect(() => () => void (sourceUrl && URL.revokeObjectURL(sourceUrl)), [sourceUrl]);
  useEffect(() => () => void (cover && URL.revokeObjectURL(cover.previewUrl)), [cover]);

  const handleFailure = useCallback(
    (e: unknown, back: Phase) => {
      if (isCanceled(e)) {
        setError(null);
        setPhase(back);
        return;
      }
      if (isPlanLimit(e)) {
        setPlanError(e);
        onError?.(e);
        setPhase(back === "ready" ? "ready" : "blocked");
        return;
      }
      setError(errorMessage(e));
      setPhase(back);
    },
    [onError],
  );

  // 1) plan limits before anything else
  useEffect(() => {
    const ac = new AbortController();
    fetchMediaLimits(partnerId, ac.signal)
      .then((l) => {
        setLimits(l);
        setPhase(videoQuotaMessage(l) ? "blocked" : "pick");
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        if (isPlanLimit(e)) {
          setPlanError(e);
          setPhase("blocked");
        } else setPhase("pick"); // endpoint unavailable: the server still enforces the limits on upload
      });
    return () => ac.abort();
  }, [partnerId]);

  const maxSeconds = (p: VideoProbe) => Math.min(limits?.videoMaxSeconds ?? Infinity, maxDurationSeconds(p.hasAudio));

  const transcode = useCallback(
    async (file: File, p: VideoProbe, trim: { start: number; end: number } | null) => {
      const ac = new AbortController();
      abortRef.current = ac;
      setPhase("transcoding");
      setProgress(0);
      setEngine(null);
      setError(null);
      try {
        const out = await transcodeVideo(file, { probe: p, trim, signal: ac.signal, onProgress: setProgress, onEngine: setEngine });
        const url = URL.createObjectURL(out.file);
        setVideo(out);
        setVideoUrl(url);
        const frame = await extractFrame(out.file, defaultCoverTime(out.durationSeconds)).catch(() => null);
        if (frame) setCover({ input: { file: frame.blob, width: frame.width, height: frame.height }, previewUrl: URL.createObjectURL(frame.blob), source: "frame" });
        else setCover(null);
        setPhase("ready");
      } catch (e) {
        handleFailure(e, "pick");
      } finally {
        abortRef.current = null;
      }
    },
    [handleFailure],
  );

  const start = useCallback(
    async (file: File) => {
      setError(null);
      setPlanError(null);
      if (!isAcceptedSource(file)) {
        setError("Formato não suportado. Envie um vídeo MP4, MOV, WebM, MKV ou 3GP.");
        return;
      }
      if (limits && videoQuotaMessage(limits)) {
        setPhase("blocked");
        return;
      }
      setSource(file);
      setVideo(null);
      setCover(null);
      setVideoUrl(null);
      setPhase("probing");
      try {
        const p = await probeVideo(file);
        setProbe(p);
        if (p.durationSeconds > maxSeconds(p) + 0.05) {
          setTrimStart(0);
          setSourceUrl(URL.createObjectURL(file));
          setPhase("trim");
          return;
        }
        await transcode(file, p, null);
      } catch (e) {
        handleFailure(e, "pick");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [limits, transcode, handleFailure],
  );

  useEffect(() => {
    if (initialFile && !startedInitial.current && phase === "pick") {
      startedInitial.current = true;
      void start(initialFile);
    }
  }, [initialFile, phase, start]);

  async function grabCurrentFrame() {
    const el = previewRef.current;
    if (!el || !el.videoWidth) return;
    try {
      const f = await captureFrame(el);
      setCover({ input: { file: f.blob, width: f.width, height: f.height }, previewUrl: URL.createObjectURL(f.blob), source: "frame" });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onCoverCropped(file: File, crop: { x: number; y: number; width: number; height: number }) {
    try {
      const preview = await cropPreview(file, crop);
      setCover({ input: { file, crop }, previewUrl: URL.createObjectURL(preview), source: "image" });
      setCropFile(null);
      setPhase("ready");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function upload() {
    if (!video) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase("uploading");
    setProgress(0);
    setError(null);
    try {
      const m = await uploadTranscodedVideo(video, purpose, { partnerId, cover: cover?.input ?? null, signal: ac.signal, onProgress: (p) => setProgress(p.overall) });
      setLimits((l) => (l ? { ...l, videosUsedToday: l.videosUsedToday + 1 } : l));
      await onUploaded({ ...m, durationSeconds: video.durationSeconds });
      setPhase("done");
    } catch (e) {
      handleFailure(e, "ready");
    } finally {
      abortRef.current = null;
    }
  }

  function reset() {
    abortRef.current?.abort();
    setSource(null);
    setProbe(null);
    setVideo(null);
    setVideoUrl(null);
    setSourceUrl(null);
    setCover(null);
    setError(null);
    setPhase(limits && videoQuotaMessage(limits) ? "blocked" : "pick");
  }

  const aspect = video ? video.width / video.height : 16 / 9;
  const portrait = video ? video.height > video.width : false;
  const upgradeHref = limits?.audience === "OWNER" || partnerId === null ? "/conta#plano" : "/painel/plano";

  return (
    <div className={cn("space-y-3", className)}>
      {limits && phase !== "blocked" && <QuotaLine limits={limits} />}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-100">
          <span className="flex-1">{error}</span>
          <button type="button" className="shrink-0" aria-label="Fechar aviso" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {(phase === "blocked" || !!planError) && <VideoPlanNotice limits={limits} error={planError} href={upgradeHref} />}

      {phase === "loading" && <p className="text-sm text-[var(--muted)]">Verificando os limites do seu plano…</p>}

      {phase === "pick" && (
        <>
          <input
            ref={pickRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void start(f);
            }}
          />
          <button type="button" onClick={() => pickRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-6 text-sm hover:border-brand-400">
            <Film className="h-6 w-6 text-[var(--muted)]" aria-hidden />
            <span className="font-medium">Escolher vídeo</span>
            <span className="text-center text-xs text-[var(--muted)]">
              MP4, MOV, WebM, MKV ou 3GP. O vídeo é convertido aqui no navegador para MP4 720p/1080p (16:9 ou 9:16){limits?.videoMaxSeconds ? `, até ${limits.videoMaxSeconds} s` : ""}.
            </span>
          </button>
          {onCancel && (
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          )}
        </>
      )}

      {phase === "probing" && <p className="text-sm text-[var(--muted)]">Analisando o vídeo…</p>}

      {phase === "trim" && probe && source && (
        <TrimStep
          probe={probe}
          sourceUrl={sourceUrl}
          maxSeconds={maxSeconds(probe)}
          planLimited={!!limits?.videoMaxSeconds && probe.durationSeconds > limits.videoMaxSeconds}
          start={trimStart}
          onStart={setTrimStart}
          onConfirm={() => void transcode(source, probe, trimWindow(probe.durationSeconds, maxSeconds(probe), trimStart))}
          onCancel={reset}
        />
      )}

      {(phase === "transcoding" || phase === "uploading") && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {phase === "transcoding" ? (engine === "ffmpeg" ? "Convertendo no modo de compatibilidade (pode demorar)…" : "Convertendo o vídeo…") : progress < 10 && cover ? "Enviando a capa…" : "Enviando o vídeo…"} {progress}%
          </p>
          <ProgressBar value={progress} label={phase === "transcoding" ? "Progresso da conversão" : "Progresso do envio"} />
          {phase === "transcoding" && engine === "ffmpeg" && <p className="text-xs text-[var(--muted)]">Seu navegador não tem conversão acelerada. Mantenha esta aba aberta até terminar.</p>}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => abortRef.current?.abort()}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {phase === "ready" && video && videoUrl && (
        <div className="space-y-3">
          <video ref={previewRef} src={videoUrl} controls playsInline preload="auto" className={cn("mx-auto rounded-xl bg-black", portrait ? "aspect-[9/16] max-h-[55vh]" : "aspect-video w-full")} />
          <p className="text-center text-xs text-[var(--muted)]">{formatVideoInfo(video)}</p>
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-sm font-medium">Capa do vídeo</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className={cn("overflow-hidden rounded-lg border bg-ink-100 dark:bg-ink-900", portrait ? "h-28 w-[63px]" : "h-[63px] w-28")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {cover ? <img src={cover.previewUrl} alt="Capa selecionada" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] text-[var(--muted)]">sem capa</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => void grabCurrentFrame()}>
                  <Camera className="h-4 w-4" aria-hidden /> Usar quadro atual
                </Button>
                <input
                  ref={coverPickRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) {
                      setCropFile(f);
                      setPhase("cropping");
                    }
                  }}
                />
                <Button type="button" variant="ghost" onClick={() => coverPickRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" aria-hidden /> Trocar capa
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">Pause o vídeo no quadro desejado e toque em “Usar quadro atual”, ou envie uma imagem e recorte em {portrait ? "9:16" : "16:9"}.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={reset}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Outro vídeo
            </Button>
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="button" onClick={() => void upload()} disabled={!!planError}>
              <Upload className="h-4 w-4" aria-hidden /> {submitLabel}
            </Button>
          </div>
        </div>
      )}

      {phase === "cropping" && video && (
        <ImageCropper
          file={cropFile}
          onFile={setCropFile}
          aspect={aspect}
          size={320}
          confirmLabel="Usar como capa"
          onCancel={() => {
            setCropFile(null);
            setPhase("ready");
          }}
          onConfirm={(f, crop) => void onCoverCropped(f, crop)}
        />
      )}

      {phase === "done" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-100">
          <span>Vídeo enviado!</span>
          <Button type="button" variant="ghost" onClick={reset}>
            Enviar outro
          </Button>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-brand-500 transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function QuotaLine({ limits }: { limits: MediaLimits }) {
  const parts: string[] = [];
  if (limits.videosPerDay != null) {
    const left = Math.max(0, limits.videosPerDay - limits.videosUsedToday);
    parts.push(`${left} de ${limits.videosPerDay} vídeo${limits.videosPerDay === 1 ? "" : "s"} restante${left === 1 ? "" : "s"} hoje`);
  }
  if (limits.videoMaxSeconds) parts.push(`até ${limits.videoMaxSeconds} s por vídeo`);
  if (!parts.length) return null;
  return <p className="text-xs text-[var(--muted)]">{parts.join(" · ")}</p>;
}

function VideoPlanNotice({ limits, error, href }: { limits: MediaLimits | null; error: unknown; href: string }) {
  const info = planLimitInfo(error);
  const msg = (error ? videoPlanLimitMessage(info) ?? errorMessage(error) : null) ?? (limits ? videoQuotaMessage(limits) : null) ?? "Limite de vídeos do plano atingido.";
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
      <Crown className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">Limite do plano</p>
        <p className="mt-0.5">{msg}</p>
        <Link href={href} className="mt-2 inline-flex text-sm font-medium underline underline-offset-2">
          Ver planos e fazer upgrade
        </Link>
      </div>
    </div>
  );
}

function TrimStep({ probe, sourceUrl, maxSeconds, planLimited, start, onStart, onConfirm, onCancel }: { probe: VideoProbe; sourceUrl: string | null; maxSeconds: number; planLimited: boolean; start: number; onStart: (n: number) => void; onConfirm: () => void; onCancel: () => void }) {
  const max = Math.floor(maxSeconds);
  const maxStart = Math.max(0, Math.floor(probe.durationSeconds - max));
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && Number.isFinite(start)) ref.current.currentTime = start;
  }, [start]);
  return (
    <div className="space-y-3">
      <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
        {planLimited ? videoDurationMessage(max) : MSG_TOO_BIG} Este vídeo tem {formatDuration(probe.durationSeconds)}.
      </div>
      {sourceUrl && <video ref={ref} src={sourceUrl} muted playsInline preload="metadata" className="mx-auto max-h-[40vh] rounded-xl bg-black" />}
      {maxStart > 0 && (
        <label className="block text-sm">
          <span className="label">
            Início do trecho: {formatDuration(start)} → {formatDuration(start + max)}
          </span>
          <input type="range" min={0} max={maxStart} step={1} value={start} onChange={(e) => onStart(Number(e.target.value))} className="w-full accent-brand-500" aria-label="Início do trecho" />
        </label>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={onConfirm}>
          {start > 0 ? `Usar ${max} segundos a partir de ${formatDuration(start)}` : `Usar os primeiros ${max} segundos`}
        </Button>
      </div>
    </div>
  );
}
