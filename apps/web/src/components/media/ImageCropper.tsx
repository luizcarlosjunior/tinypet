"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Upload } from "lucide-react";

export type CropRect = { x: number; y: number; width: number; height: number };

/**
 * Canvas-based square cropper: pick a file, drag to pan, zoom with the slider.
 * Emits the crop rect in SOURCE-IMAGE pixels via `onConfirm(file, crop)`.
 */
export function ImageCropper({ file, onFile, onConfirm, onCancel, size = 280, submitting, accept = "image/jpeg,image/png,image/webp", confirmLabel = "Salvar" }: { file: File | null; onFile: (f: File | null) => void; onConfirm: (file: File, crop: CropRect) => void; onCancel?: () => void; size?: number; submitting?: boolean; accept?: string; confirmLabel?: string }) {
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
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // base scale: cover the square with the image
  const baseScale = img ? Math.max(size / img.naturalWidth, size / img.naturalHeight) : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback(
    (o: { x: number; y: number }, z = zoom) => {
      if (!img) return o;
      const s = baseScale * z;
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      const maxX = Math.max(0, (w - size) / 2);
      const maxY = Math.max(0, (h - size) / 2);
      return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
    },
    [img, baseScale, size, zoom],
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    if (!img) return;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const x = (size - w) / 2 + offset.x;
    const y = (size - h) / 2 + offset.y;
    ctx.drawImage(img, x, y, w, h);
  }, [img, scale, offset, size]);

  useEffect(() => setOffset((o) => clamp(o)), [zoom, clamp]);

  function crop(): CropRect | null {
    if (!img) return null;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const x0 = (size - w) / 2 + offset.x;
    const y0 = (size - h) / 2 + offset.y;
    const sx = Math.max(0, Math.round(-x0 / scale));
    const sy = Math.max(0, Math.round(-y0 / scale));
    const sw = Math.min(img.naturalWidth - sx, Math.round(size / scale));
    const sh = Math.min(img.naturalHeight - sy, Math.round(size / scale));
    const side = Math.min(sw, sh);
    return { x: sx, y: sy, width: side, height: side };
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
              width={size}
              height={size}
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
            <p className="text-xs text-[var(--muted)]">Arraste a imagem para posicionar o recorte quadrado.</p>
          </div>
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
                if (c && file) onConfirm(file, c);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
