import React, { useMemo } from "react";
import { View } from "react-native";
import { fmtDate, fmtWeight, toDate, fmtDay } from "@/lib/format";
import { radius, useTheme } from "@/lib/theme";
import type { Measurement } from "@/lib/types";
import { Text } from "@/components/ui";

const H = 160;
const W_PAD = 8;

/**
 * Simple weight-over-time chart built from plain Views (no SVG dependency):
 * absolutely positioned dots + thin connecting segments, optional shaded reference band.
 * Vet-verified points are drawn as filled squares; owner points as circles.
 */
export function WeightChart({ items, reference }: { items: Measurement[]; reference?: { minG: number; maxG: number } | null }) {
  const t = useTheme();
  const data = useMemo(() => {
    const sorted = [...items].filter((m) => m.weightG > 0).sort((a, b) => (toDate(a.measuredAt)?.getTime() ?? 0) - (toDate(b.measuredAt)?.getTime() ?? 0));
    if (sorted.length === 0) return null;
    const ts = sorted.map((m) => toDate(m.measuredAt)?.getTime() ?? 0);
    const ws = sorted.map((m) => m.weightG);
    const minT = Math.min(...ts);
    const maxT = Math.max(...ts);
    let minW = Math.min(...ws, reference?.minG ?? Infinity);
    let maxW = Math.max(...ws, reference?.maxG ?? -Infinity);
    const pad = Math.max((maxW - minW) * 0.15, 100);
    minW = Math.max(0, minW - pad);
    maxW = maxW + pad;
    const spanT = Math.max(maxT - minT, 1);
    const spanW = Math.max(maxW - minW, 1);
    const pts = sorted.map((m, i) => ({ m, x: (ts[i]! - minT) / spanT, y: 1 - (ws[i]! - minW) / spanW }));
    const refBand = reference ? { top: 1 - (reference.maxG - minW) / spanW, bottom: 1 - (reference.minG - minW) / spanW } : null;
    return { pts, minW, maxW, refBand, first: sorted[0]!, last: sorted[sorted.length - 1]! };
  }, [items, reference]);

  const [width, setWidth] = React.useState(0);
  if (!data) return null;
  const innerW = Math.max(width - W_PAD * 2, 1);
  const px = (x: number) => W_PAD + x * innerW;
  const py = (y: number) => y * (H - 20) + 10;

  return (
    <View accessibilityLabel={`Gráfico de peso de ${fmtWeight(data.first.weightG)} em ${fmtDay(data.first.measuredAt)} até ${fmtWeight(data.last.weightG)} em ${fmtDay(data.last.measuredAt)}`}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: H, backgroundColor: t.surfaceAlt, borderRadius: radius.md, overflow: "hidden" }}>
        {data.refBand ? <View style={{ position: "absolute", left: 0, right: 0, top: py(data.refBand.top), height: Math.max(py(data.refBand.bottom) - py(data.refBand.top), 2), backgroundColor: t.successSoft, opacity: 0.7 }} /> : null}
        {[0.25, 0.5, 0.75].map((g) => (
          <View key={g} style={{ position: "absolute", left: 0, right: 0, top: py(g), height: 1, backgroundColor: t.border }} />
        ))}
        {width > 0 &&
          data.pts.slice(1).map((p, i) => {
            const a = data.pts[i]!;
            const x1 = px(a.x);
            const y1 = py(a.y);
            const x2 = px(p.x);
            const y2 = py(p.y);
            const len = Math.hypot(x2 - x1, y2 - y1);
            const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
            return <View key={i} style={{ position: "absolute", left: x1, top: y1, width: len, height: 2, backgroundColor: t.primary, transform: [{ translateX: 0 }, { rotate: `${angle}deg` }], transformOrigin: "0 50%" as never }} />;
          })}
        {width > 0 &&
          data.pts.map((p, i) => {
            const vet = !!p.m.vetVerified;
            const size = vet ? 10 : 9;
            return <View key={p.m.id ?? i} style={{ position: "absolute", left: px(p.x) - size / 2, top: py(p.y) - size / 2, width: size, height: size, borderRadius: vet ? 2 : size / 2, backgroundColor: vet ? t.info : t.primary, borderWidth: 1.5, borderColor: t.surface }} />;
          })}
        <Text variant="tiny" tone="faint" style={{ position: "absolute", left: 6, top: 4 }}>
          {fmtWeight(Math.round(data.maxW))}
        </Text>
        <Text variant="tiny" tone="faint" style={{ position: "absolute", left: 6, bottom: 4 }}>
          {fmtWeight(Math.round(data.minW))}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text variant="tiny" tone="faint">
          {fmtDay(data.first.measuredAt)}
        </Text>
        <Text variant="tiny" tone="faint">
          {fmtDay(data.last.measuredAt)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary }} />
          <Text variant="tiny" tone="muted">
            Tutor
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: t.info }} />
          <Text variant="tiny" tone="muted">
            Veterinário
          </Text>
        </View>
        {reference ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, backgroundColor: t.successSoft }} />
            <Text variant="tiny" tone="muted">
              Faixa de referência
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
