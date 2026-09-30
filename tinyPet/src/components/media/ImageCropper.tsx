"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Upload } from "lucide-react";
import { clampOffset, coverScale, viewportCropRect, viewportSize } from "@/lib/video/geometry";

export type CropRect = { x: number; y: number; width: number; height: number };

/**
 * Canvas-based cropper: pick a file, drag to pan, zoom with the slider, arrows to nudge.
 * `aspect` = width / height of the crop (1 = square, 16/9, 9/16…); `size` is the viewport's long side.
 * Emits the crop rect in SOURCE-IMAGE pixels (exactly `aspect`, rounded) via `onConfirm(file, crop)`.
 */
export function ImageCropper({ file, onFile, onConfirm, onCancel, size = 280, aspect = 1, submitting, accept = "image/jpeg,image/png,image/webp", confirmLabel = "Salvar", hint, onCropChange, embedded = false }: { file: File | null; onFile: (f: File | null) => void; onConfirm?: (file: File, crop: CropRect) => void; onCancel?: () => void; size?: number; aspect?: number; submitting?: boolean; accept?: string; confirmLabel?: string; hint?: string; /** Reports the current crop (source px) on every change — for forms with their own submit button. */ onCropChange?: (crop: CropRect | null) => void; /** Hide the cropper's own buttons (the parent form submits). */ embedded?: boolean }) {
  const view = viewportSize(size, aspect);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setImg(null);
      return;
    }
    // Revoke only once the image has loaded/failed: revoking in the cleanup while it is still loading (e.g. the
    // dev StrictMode double effect) aborts the load with ERR_FILE_NOT_FOUND. A decoded image stays drawable.
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      URL.revokeObjectURL(url);
      if (cancelled) return;
      setImg(i);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    i.onerror = () => URL.revokeObjectURL(url);
    i.src = url;
    return () => {
      cancelled = true;
    };
  }, [file]);

  // base scale: cover the viewport with the image
  const baseScale = img ? coverScale(img.naturalWidth, img.naturalHeight, view.width, view.height) : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback(
    (o: { x: number; y: number }, z = zoom) => (img ? clampOffset(o, img.naturalWidth, img.naturalHeight, view.width, view.height, baseScale * z) : o),
    [img, baseScale, view.width, view.height, zoom],
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, view.width, view.height);
    if (!img) return;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const x = (view.width - w) / 2 + offset.x;
    const y = (view.height - h) / 2 + offset.y;
    ctx.drawImage(img, x, y, w, h);
  }, [img, scale, offset, view.width, view.height]);

  useEffect(() => setOffset((o) => clamp(o)), [zoom, clamp]);

  useEffect(() => {
    onCropChange?.(img ? viewportCropRect({ imgW: img.naturalWidth, imgH: img.naturalHeight, viewW: view.width, viewH: view.height, scale, offset, aspect }) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, scale, offset, aspect, view.width, view.height]);

  function crop(): CropRect | null {
    if (!img) return null;
    return viewportCropRect({ imgW: img.naturalWidth, imgH: img.naturalHeight, viewW: view.width, viewH: view.height, scale, offset, aspect });
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }));
  };
  const onPointerUp = () => (drag.current = null);
  const onKey = (e: React.KeyboardEvent) => {
    const step = 10;
    const map: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = map[e.key];
    if (m) {
      e.preventDefault();
      setOffset((o) => clamp({ x: o.x + m[0], y: o.y + m[1] }));
    }
  };

  return (
    <div className="space-y-3">
      {!file ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-sm text-[var(--muted)] hover:border-brand-400">
          <Upload className="h-6 w-6" aria-hidden />
          <span>Escolher imagem (JPG, PNG ou WebP, até 10 MB)</span>
          <input type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3">
            <canvas
              ref={canvasRef}
              width={view.width}
              height={view.height}
              tabIndex={0}
              role="img"
              aria-label="Área de recorte: arraste para posicionar, use as setas para ajustar"
              className="cursor-grab touch-none rounded-xl border bg-ink-100 outline-none focus:ring-2 focus:ring-brand-400 active:cursor-grabbing dark:bg-ink-900"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKey}
            />
            <label className="flex w-full max-w-xs items-center gap-2 text-xs">
              <span>Zoom</span>
              <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="flex-1 accent-brand-500" aria-label="Zoom" />
            </label>
            <p className="text-xs text-[var(--muted)]">{hint ?? (aspect === 1 ? "Arraste a imagem para posicionar o recorte quadrado." : `Arraste a imagem para posicionar o recorte ${aspect > 1 ? "16:9 (horizontal)" : "9:16 (vertical)"}.`)}</p>
          </div>
          {!embedded && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onFile(null)}>
              Trocar imagem
            </Button>
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button
              type="button"
              loading={submitting}
              onClick={() => {
                const c = crop();
                if (c && file) onConfirm?.(file, c);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
          )}
        </>
      )}
    </div>
  );
}
