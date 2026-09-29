"use client";
/* eslint-disable @next/next/no-img-element */
import "react-image-crop/dist/ReactCrop.css";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from "react-image-crop";
import { ChevronDown, ImagePlus, Loader2, Maximize2, RotateCcw, Scissors, SlidersHorizontal, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/painel/ui";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  ACCEPT_ATTR,
  clampQuality,
  cropOutputSize,
  DEFAULT_QUALITY,
  estimateBlogMedia,
  formatBytes,
  loadImage,
  maxAspectRect,
  renderToFile,
  toNaturalCrop,
  uploadBlogMedia,
  validateImageFile,
  type BlogMediaItem,
  type CropPreset,
  type Size,
} from "@/lib/blog-media";
import { ProgressBar, QualitySlider } from "./common";

const PCT: Size = { width: 100, height: 100 };

/**
 * Crop + upload (reference `ImageUploadWithCrop`): pick a file → full-screen crop at the preset aspect → canvas renders
 * the exact preset size → WebP (quality slider, "otimizar" toggle) or PNG sent with `format=png&optimize=true`.
 * Live size estimate via `/media/estimate` (debounced).
 */
export function CropUploader({
  preset,
  value,
  onChange,
  label,
  alt,
  disabled,
  buttonOnly,
  buttonLabel = "Escolher imagem",
}: {
  preset: CropPreset;
  value?: string | null;
  onChange: (url: string | null, media?: BlogMediaItem) => void;
  label?: string;
  alt?: string;
  disabled?: boolean;
  /** Only the trigger button (used inside the editor image modal). */
  buttonOnly?: boolean;
  buttonLabel?: string;
}) {
  const id = useId();
  const { toast } = useToast();
  const forcePng = preset.format === "png";
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [source, setSource] = useState<{ name: string; size: number; type: string } | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [area, setArea] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState<PercentCrop>();
  const [webp, setWebp] = useState(!forcePng);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [showOptions, setShowOptions] = useState(false);
  const [estimate, setEstimate] = useState<{ png: number | null; webp: number | null } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const open = !!src;
  const wantWebp = !forcePng && webp;
  const out = useMemo(() => cropOutputSize({ width: 0, height: 0 }, preset), [preset]);

  const close = useCallback(() => {
    if (uploading) return;
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setCrop(undefined);
    setNatural(null);
    setEstimate(null);
    setZoom(1);
    if (fileRef.current) fileRef.current.value = "";
  }, [src, uploading]);

  useEffect(() => {
    if (!open) return;
    const el = areaRef.current;
    if (!el) return;
    const update = () => setArea({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => {
      ro?.disconnect();
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const display = useMemo<Size | null>(() => {
    if (!natural || !area.width || !area.height) return null;
    const fit = Math.min(area.width / natural.width, area.height / natural.height);
    if (!Number.isFinite(fit) || fit <= 0) return null;
    return { width: natural.width * fit * zoom, height: natural.height * fit * zoom };
  }, [natural, area, zoom]);

  // Live estimate (lossless PNG crop → server computes optimized PNG/WebP size at the chosen quality).
  useEffect(() => {
    if (!open || !crop || !natural || !imgRef.current || crop.width <= 0) return;
    let cancelled = false;
    const ctrl = new AbortController();
    setEstimating(true);
    const t = setTimeout(async () => {
      try {
        const rect = toNaturalCrop(crop, PCT, natural);
        const file = await renderToFile(imgRef.current!, rect, out, "png", 100, source?.name ?? "recorte.png");
        const r = await estimateBlogMedia(file, quality, ctrl.signal);
        if (!cancelled) setEstimate({ png: r.pngSize ?? null, webp: r.webpSize ?? null });
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(t);
    };
  }, [open, crop, quality, natural, out, source?.name]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      toast(err, "error");
      e.target.value = "";
      return;
    }
    setSource({ name: file.name, size: file.size, type: (file.type.split("/")[1] ?? "").toUpperCase() });
    setSrc(URL.createObjectURL(file));
  };

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const n = { width: img.naturalWidth, height: img.naturalHeight };
    if (!n.width || !n.height) {
      toast("A imagem não pôde ser carregada para o recorte.", "error");
      close();
      return;
    }
    setNatural(n);
    if (areaRef.current) setArea({ width: areaRef.current.clientWidth, height: areaRef.current.clientHeight });
    setCrop(centerCrop(makeAspectCrop({ unit: "%", width: 90 }, preset.aspect, n.width, n.height), n.width, n.height));
  };

  const selectAll = () => {
    if (!natural) return;
    const r = maxAspectRect(natural, preset.aspect);
    setCrop({ unit: "%", x: (r.x / natural.width) * 100, y: (r.y / natural.height) * 100, width: (r.width / natural.width) * 100, height: (r.height / natural.height) * 100 });
  };

  const apply = async () => {
    if (!crop || !natural || !imgRef.current || crop.width <= 0 || crop.height <= 0) {
      toast("Selecione uma área de recorte.", "error");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const rect = toNaturalCrop(crop, PCT, natural);
      // A fresh element avoids any CSS sizing effects on the preview <img>.
      const img = await loadImage(imgRef.current.src);
      const file = await renderToFile(img, rect, out, wantWebp ? "webp" : "png", quality, source?.name ?? "imagem");
      const media = await uploadBlogMedia(file, wantWebp || file.type === "image/webp" ? { format: "webp", quality: clampQuality(quality), alt } : { optimize: true, format: "png", quality: clampQuality(quality), alt }, setProgress);
      onChange(media.url, media);
      toast("Imagem enviada", "success");
      setUploading(false);
      if (src) URL.revokeObjectURL(src);
      setSrc(null);
      setCrop(undefined);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast(errorMessage(e, "Falha ao recortar ou enviar a imagem."), "error");
      setUploading(false);
    }
  };

  const target = wantWebp ? estimate?.webp : estimate?.png;
  const trigger = (
    <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={disabled || uploading}>
      <ImagePlus className="h-4 w-4" aria-hidden /> {buttonLabel}
    </Button>
  );

  return (
    <div className="space-y-2">
      <input ref={fileRef} id={id} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={onFile} disabled={disabled || uploading} aria-label={label ?? preset.label} />
      {!buttonOnly && (
        <div>
          {label && <p className="label">{label}</p>}
          {value ? (
            <div className="group relative overflow-hidden rounded-xl border bg-ink-50 dark:bg-ink-900" style={{ aspectRatio: String(preset.aspect) }}>
              <img src={value} alt={alt || preset.label} className="h-full w-full object-cover" />
              <div className="absolute right-2 top-2 flex gap-1">
                <button type="button" className="rounded-lg bg-white/90 p-1.5 text-ink-900 shadow hover:bg-white" onClick={() => fileRef.current?.click()} title="Trocar / recortar" aria-label="Trocar imagem" disabled={disabled}>
                  <Scissors className="h-4 w-4" />
                </button>
                <button type="button" className="rounded-lg bg-red-600 p-1.5 text-white shadow hover:bg-red-700" onClick={() => onChange(null)} title="Remover" aria-label="Remover imagem" disabled={disabled}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {preset.width}×{preset.height}
              </span>
            </div>
          ) : (
            <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-center">
              {trigger}
              <p className="text-xs text-[var(--muted)]">
                {preset.width}×{preset.height} px · {forcePng ? "PNG otimizado" : "WebP"}
              </p>
            </div>
          )}
        </div>
      )}
      {buttonOnly && trigger}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col gap-2 bg-[var(--card)] p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Recortar imagem">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-semibold">
              Recortar imagem <span className="text-sm font-normal text-[var(--muted)]">· {preset.label} ({preset.width}×{preset.height})</span>
            </h2>
            <div className="flex items-center gap-1 rounded-xl border px-1 py-0.5">
              <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.2).toFixed(2)))} disabled={uploading || zoom <= 0.2} aria-label="Diminuir zoom">
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-xs tabular-nums text-[var(--muted)]">{Math.round(zoom * 100)}%</span>
              <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={() => setZoom((z) => Math.min(6, +(z + 0.25).toFixed(2)))} disabled={uploading || zoom >= 6} aria-label="Aumentar zoom">
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
            <Button type="button" variant="secondary" className="py-1.5" onClick={() => setZoom(1)} disabled={uploading || zoom === 1}>
              <RotateCcw className="h-4 w-4" /> Restaurar
            </Button>
            <Button type="button" variant="secondary" className="py-1.5" onClick={selectAll} disabled={uploading}>
              <Maximize2 className="h-4 w-4" /> Selecionar tudo
            </Button>
          </div>

          <div ref={areaRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl bg-ink-100/60 dark:bg-ink-900/60">
            <ReactCrop crop={crop} onChange={(_px, pct) => setCrop(pct)} aspect={preset.aspect} keepSelection ruleOfThirds minWidth={40} disabled={uploading}>
              <img
                ref={imgRef}
                src={src!}
                alt="Pré-visualização para recorte"
                onLoad={onLoad}
                style={display ? { width: display.width, height: display.height, maxWidth: "none", maxHeight: "none" } : { maxWidth: "100%", maxHeight: "60vh" }}
              />
            </ReactCrop>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
              <p className="min-w-0 truncate text-xs text-[var(--muted)]">
                <span className="font-medium text-[var(--fg)]">{wantWebp ? "WebP" : "PNG otimizado"}</span> · Qualidade {quality}% · Recorte {estimating ? "…" : target != null ? formatBytes(target) : "—"}
              </p>
              <Button type="button" variant="secondary" className="shrink-0 py-1" onClick={() => setShowOptions((v) => !v)} aria-expanded={showOptions}>
                <SlidersHorizontal className="h-4 w-4" /> {showOptions ? "Ocultar" : "Opções"}
                <ChevronDown className={cn("h-4 w-4 transition", showOptions && "rotate-180")} />
              </Button>
            </div>
            {showOptions && (
              <div className="space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  {forcePng ? (
                    <div className="rounded-xl border px-3 py-2">
                      <p className="text-sm font-medium">PNG otimizado</p>
                      <p className="text-xs text-[var(--muted)]">A imagem de compartilhamento (og:image) é sempre salva como PNG otimizado.</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Otimizar para WebP</p>
                        <p className="text-xs text-[var(--muted)]">{webp ? "Converte o recorte para WebP ao enviar" : "Desligado: salva PNG otimizado para web"}</p>
                      </div>
                      <Switch checked={webp} onChange={setWebp} label="Otimizar para WebP" disabled={uploading} />
                    </div>
                  )}
                  <QualitySlider id={`${id}-q`} value={quality} onChange={setQuality} disabled={uploading} label={`Qualidade ${wantWebp ? "WebP" : "PNG"}`} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Original</p>
                    <p className="text-sm font-semibold">{source ? formatBytes(source.size) : "—"}</p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {source?.type || "—"}
                      {natural && ` · ${natural.width}×${natural.height}px`}
                    </p>
                  </div>
                  <div className="rounded-xl border px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Recorte</p>
                    <p className="flex items-center justify-center text-sm font-semibold">{estimating ? <Loader2 className="h-4 w-4 animate-spin" /> : target != null ? formatBytes(target) : "—"}</p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {wantWebp ? "WebP" : "PNG"} · {out.width}×{out.height}px
                    </p>
                  </div>
                  <div className="rounded-xl border px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">PNG vs WebP</p>
                    {estimate?.png != null && estimate?.webp != null ? (
                      (() => {
                        const diff = estimate.png - estimate.webp;
                        const pct = estimate.png > 0 ? Math.round((Math.abs(diff) / estimate.png) * 100) : 0;
                        return (
                          <>
                            <p className="text-[10px] text-[var(--muted)]">
                              PNG {formatBytes(estimate.png)} · WebP {formatBytes(estimate.webp)}
                            </p>
                            <p className={cn("text-xs font-semibold", diff >= 0 ? "text-emerald-600" : "text-amber-600")}>
                              WebP {diff >= 0 ? "−" : "+"}
                              {formatBytes(Math.abs(diff))} ({pct}%)
                            </p>
                          </>
                        );
                      })()
                    ) : (
                      <p className="text-sm font-semibold">—</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {uploading && <ProgressBar value={progress} />}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close} disabled={uploading}>
                Cancelar
              </Button>
              <Button type="button" onClick={apply} loading={uploading} disabled={!crop || crop.width <= 0}>
                Aplicar corte e enviar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
