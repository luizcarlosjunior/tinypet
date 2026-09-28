import React from "react";
import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { font, useTheme } from "@/lib/theme";

type Variant = keyof typeof font;
type Tone = "ink" | "muted" | "faint" | "primary" | "danger" | "success" | "onPrimary";

export function Text({ variant = "body", tone = "ink", style, ...rest }: TextProps & { variant?: Variant; tone?: Tone }) {
  const t = useTheme();
  const color: Record<Tone, string> = { ink: t.ink, muted: t.inkMuted, faint: t.inkFaint, primary: t.primary, danger: t.danger, success: t.success, onPrimary: t.onPrimary };
  return <RNText {...rest} style={[font[variant] as TextStyle, { color: color[tone] }, style]} />;
}
