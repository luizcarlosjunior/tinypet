import React from "react";
import { Text as RNText, type TextStyle, type StyleProp } from "react-native";
import { openExternal } from "@/lib/links";
import { useTheme } from "@/lib/theme";

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

/** Splits plain text into text/link parts; trailing punctuation is not part of the URL. */
export function linkify(body: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  let last = 0;
  for (const m of body.matchAll(URL_RE)) {
    let url = m[0];
    const trail = /[.,;:!?)\]}'"»”]+$/.exec(url)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: body.slice(last, start) });
    if (url.length > "https://".length) parts.push({ text: url, href: url });
    else parts.push({ text: url });
    last = start + url.length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}

/** Plain-text comment body: keeps line breaks, autolinks http(s) URLs (opened via `openExternal`). */
export function LinkifiedText({ body, style }: { body: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <RNText style={[{ fontSize: 15, lineHeight: 21, color: t.ink }, style]} selectable>
      {linkify(body).map((p, i) =>
        p.href ? (
          <RNText key={i} style={{ color: t.primary, textDecorationLine: "underline" }} onPress={() => openExternal(p.href)} accessibilityRole="link">
            {p.text}
          </RNText>
        ) : (
          p.text
        ),
      )}
    </RNText>
  );
}
