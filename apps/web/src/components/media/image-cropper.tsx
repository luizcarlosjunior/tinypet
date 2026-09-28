"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { CropRect } from "@/lib/upload";

const VIEW = 280;

/**
 * Square crop editor: draws the image on a canvas, drag to position, slider/wheel to zoom.
 * Emits the crop rect in source-image pixels.
 */
export function ImageCropper({ file, onCancel, onConfirm, confirmLabel = "Usar foto", loading = false }: { file: File; onCancel: () => void; onConfirm: (crop: CropRect) => void; confirmLabel?: string; loading?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1); // multiplier over the cover scale
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
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

  const coverScale = img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) : 1;
  const scale = coverScale * zoom;

  const clamp = useCallback(
    (o: { x: number; y: number }, s: number) => {
      if (!img) return o;
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      return { x: Math.min(0, Math.max(VIEW - w, o.x)), y: Math.min(0, Math.max(VIEW - h, o.y)) };
    },
    [img],
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.drawImage(img, offset.x, offset.y, img.naturalWidth * scale, img.naturalHeight * scale);
  }, [img, offset, scale]);

  // Keep the image centered when the zoom changes.
  function changeZoom(next: number) {
    if (!img) return;
    const s0 = coverScale * zoom;
    const s1 = coverScale * next;
    const cx = (VIEW / 2 - offset.x) / s0;
    const cy = (VIEW / 2 - offset.y) / s0;
    setZoom(next);
    setOffset(clamp({ x: VIEW / 2 - cx * s1, y: VIEW / 2 - cy * s1 }, s1));
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }, scale));
  }
  function onPointerUp() {
    drag.current = null;
  }
  function onWheel(e: React.WheelEvent) {
    changeZoom(Math.min(4, Math.max(1, zoom - e.deltaY * 0.002)));
  }
  function onKeyDown(e: React.KeyboardEvent) {
    const step = 10;
    const map: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const d = map[e.key];
    if (d) {
      e.preventDefault();
      setOffset((o) => clamp({ x: o.x + d[0], y: o.y + d[1] }, scale));
    }
  }

  function confirm() {
    if (!img) return;
    const x = Math.max(0, Math.round(-offset.x / scale));
    const y = Math.max(0, Math.round(-offset.y / scale));
    const size = Math.round(VIEW / scale);
    onConfirm({ x, y, width: Math.min(size, img.naturalWidth - x), height: Math.min(size, img.naturalHeight - y) });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-[var(--muted)]">Arraste para posicionar e use o controle para aproximar.</p>
      <div className="relative overflow-hidden rounded-2xl border bg-ink-100 dark:bg-ink-800" style={{ width: VIEW, height: VIEW }}>
        <canvas
          ref={canvasRef}
          width={VIEW}
          height={VIEW}
          tabIndex={0}
          role="img"
          aria-label="Pré-visualização do recorte. Use as setas do teclado para mover."
          className="cursor-move touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
        />
        {!img && <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">Carregando…</div>}
      </div>
      <label className="flex w-full max-w-[280px] items-center gap-2 text-xs text-[var(--muted)]">
        <span>Zoom</span>
        <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => changeZoom(parseFloat(e.target.value))} className="w-full accent-brand-500" aria-label="Zoom" />
      </label>
      <div className="flex w-full justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={confirm} disabled={!img} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
