import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@/lib/theme";
import { Button, Text } from "@/components/ui";
import type { CropRect } from "@/lib/video/transcode";

const MAX_ZOOM = 5;
const DIM = "rgba(0,0,0,0.6)";

type Props = {
  visible: boolean;
  /** Image to crop (EXIF orientation already baked; width/height are the displayed pixels). */
  image: { uri: string; width: number; height: number } | null;
  /** Frame aspect (width / height): 16/9 or 9/16 for video covers. */
  aspect: number;
  title?: string;
  onCancel: () => void;
  onConfirm: (rect: CropRect) => void;
};

/**
 * JS crop tool (iOS ImagePicker `allowsEditing` ignores `aspect` and is always square).
 * Fixed frame at `aspect`; pinch to zoom (around the focal point) and pan the image behind it.
 * The image always covers the frame. Returns the crop rect in SOURCE pixels.
 */
export function ImageCropperModal({ visible, image, aspect, title = "Ajustar capa", onCancel, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const [area, setArea] = useState({ w: win.width, h: win.height * 0.6 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - area.w) > 1 || Math.abs(height - area.h) > 1) setArea({ w: width, h: height });
  };

  // Frame: as large as possible inside the area with a margin.
  const margin = spacing.lg;
  const maxW = Math.max(1, area.w - margin * 2);
  const maxH = Math.max(1, area.h - margin * 2);
  const frameW = Math.min(maxW, maxH * aspect);
  const frameH = frameW / aspect;

  const imgW = image?.width || 1;
  const imgH = image?.height || 1;
  // Base scale: image covers the frame at zoom 1.
  const base = Math.max(frameW / imgW, frameH / imgH);
  const dispW = imgW * base;
  const dispH = imgH * base;

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  // Reset when a new image / frame comes in.
  const key = `${image?.uri}|${frameW.toFixed(1)}|${frameH.toFixed(1)}`;
  useEffect(() => {
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
  }, [key, scale, tx, ty]);

  const gesture = useMemo(() => {
    const clamp = (s: number, x: number, y: number) => {
      "worklet";
      const limX = Math.max(0, (dispW * s - frameW) / 2);
      const limY = Math.max(0, (dispH * s - frameH) / 2);
      return { x: Math.min(limX, Math.max(-limX, x)), y: Math.min(limY, Math.max(-limY, y)) };
    };
    const pinch = Gesture.Pinch().onChange((e) => {
      "worklet";
      const prev = scale.value;
      const next = Math.min(MAX_ZOOM, Math.max(1, prev * e.scaleChange));
      const k = next / prev;
      // Keep the focal point fixed (coordinates relative to the area center = frame center).
      const fx = e.focalX - area.w / 2;
      const fy = e.focalY - area.h / 2;
      const c = clamp(next, fx - (fx - tx.value) * k, fy - (fy - ty.value) * k);
      scale.value = next;
      tx.value = c.x;
      ty.value = c.y;
    });
    const pan = Gesture.Pan()
      .averageTouches(true)
      .onChange((e) => {
        "worklet";
        const c = clamp(scale.value, tx.value + e.changeX, ty.value + e.changeY);
        tx.value = c.x;
        ty.value = c.y;
      });
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        "worklet";
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      });
    return Gesture.Simultaneous(pinch, pan, doubleTap);
  }, [area.w, area.h, dispW, dispH, frameW, frameH, scale, tx, ty]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const confirm = () => {
    if (!image) return;
    const s = scale.value;
    const k = base * s; // screen px per source px
    // Frame top-left inside the scaled image (image center is offset by tx/ty from the frame center).
    const left = (dispW * s) / 2 - tx.value - frameW / 2;
    const top = (dispH * s) / 2 - ty.value - frameH / 2;
    let width = frameW / k;
    let height = width / aspect;
    if (height > imgH) {
      height = imgH;
      width = height * aspect;
    }
    if (width > imgW) {
      width = imgW;
      height = width / aspect;
    }
    const originX = Math.min(Math.max(0, left / k), imgW - width);
    const originY = Math.min(Math.max(0, top / k), imgH - height);
    onConfirm({ originX: Math.round(originX), originY: Math.round(originY), width: Math.round(width), height: Math.round(height) });
  };

  const frameLeft = (area.w - frameW) / 2;
  const frameTop = (area.h - frameH) / 2;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} presentationStyle="fullScreen" statusBarTranslucent>
      <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.header}>
          <Text variant="h3" style={{ color: "#fff" }}>
            {title}
          </Text>
          <Text variant="small" style={{ color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
            Arraste e use dois dedos para ajustar o zoom
          </Text>
        </View>

        <GestureDetector gesture={gesture}>
          <View style={styles.area} onLayout={onLayout} collapsable={false}>
            {image ? (
              <Animated.View style={[{ position: "absolute", width: dispW, height: dispH, left: (area.w - dispW) / 2, top: (area.h - dispH) / 2 }, imageStyle]}>
                <Image source={{ uri: image.uri }} style={{ width: "100%", height: "100%" }} contentFit="fill" />
              </Animated.View>
            ) : null}
            {/* Dimmed mask around the frame */}
            <View pointerEvents="none" style={[styles.mask, { left: 0, right: 0, top: 0, height: frameTop }]} />
            <View pointerEvents="none" style={[styles.mask, { left: 0, right: 0, top: frameTop + frameH, bottom: 0 }]} />
            <View pointerEvents="none" style={[styles.mask, { left: 0, width: frameLeft, top: frameTop, height: frameH }]} />
            <View pointerEvents="none" style={[styles.mask, { right: 0, width: frameLeft, top: frameTop, height: frameH }]} />
            <View pointerEvents="none" style={[styles.frame, { left: frameLeft, top: frameTop, width: frameW, height: frameH }]}>
              <View style={[styles.grid, { left: frameW / 3 }]} />
              <View style={[styles.grid, { left: (frameW * 2) / 3 }]} />
              <View style={[styles.gridH, { top: frameH / 3 }]} />
              <View style={[styles.gridH, { top: (frameH * 2) / 3 }]} />
            </View>
          </View>
        </GestureDetector>

        <View style={styles.actions}>
          <Pressable onPress={onCancel} accessibilityRole="button" style={styles.cancel} hitSlop={8}>
            <Text style={{ color: "#fff" }}>Cancelar</Text>
          </Pressable>
          <Button title="Usar recorte" icon="crop-outline" onPress={confirm} disabled={!image} style={{ flex: 1 }} />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  area: { flex: 1, overflow: "hidden" },
  mask: { position: "absolute", backgroundColor: DIM },
  frame: { position: "absolute", borderWidth: 2, borderColor: "#fff" },
  grid: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.5)" },
  gridH: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.5)" },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  cancel: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
});
