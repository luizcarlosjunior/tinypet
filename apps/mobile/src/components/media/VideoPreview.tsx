import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { radius } from "@/lib/theme";

/** Inline player (expo-video) for a local or remote MP4. `aspect` = width / height. */
export function VideoPreview({ uri, aspect, autoPlay = false, style }: { uri: string; aspect: number; autoPlay?: boolean; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    if (autoPlay) p.play();
  });
  // Portrait videos would be very tall at full width: cap the height and center.
  const portrait = aspect < 1;
  return (
    <View style={[{ alignItems: "center", backgroundColor: "#000", borderRadius: radius.md, overflow: "hidden" }, style]}>
      <VideoView player={player} nativeControls allowsFullscreen contentFit="contain" style={portrait ? { height: 360, aspectRatio: aspect } : { width: "100%", aspectRatio: aspect }} />
    </View>
  );
}
