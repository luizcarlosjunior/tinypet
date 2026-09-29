import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text as RNText, View, useWindowDimensions, type TextStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { parseHtml, textOf, youtubeId, type HtmlElement, type HtmlNode } from "@/lib/html";
import { isWebUrl, mailtoUrl, openExternal, openLocal } from "@/lib/links";
import { absUrl } from "@/lib/blog";
import { radius, spacing, useTheme, type Theme } from "@/lib/theme";

/**
 * WebView-free renderer for the blog's sanitized HTML (TipTap output). Supports headings, paragraphs, lists,
 * blockquote, pre/code, hr, br, strong/em/u/s/sub/sup/mark, links (http/https/mailto only; opened via `openExternal`),
 * images (only from `imageHosts`), simple tables and YouTube iframes (thumbnail that opens the video). Anything else
 * is rendered as its text content or dropped.
 */
export function BlogHtml({ html, imageHosts, onLinkPress }: { html: string; imageHosts: string[]; onLinkPress?: (href: string) => boolean | void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const nodes = useMemo(() => parseHtml(html ?? ""), [html]);
  const ctx: Ctx = {
    t,
    width,
    hosts: new Set(imageHosts.map((h) => h.toLowerCase())),
    onLink: (href) => {
      if (onLinkPress?.(href)) return;
      if (/^mailto:/i.test(href)) {
        const url = mailtoUrl(href.replace(/^mailto:/i, "").split("?")[0] ?? "");
        if (url) void openLocal(url);
        return;
      }
      void openExternal(href);
    },
  };
  return <View>{renderBlocks(nodes, ctx, "r", false)}</View>;
}

type Ctx = { t: Theme; width: number; hosts: Set<string>; onLink: (href: string) => void };

const INLINE = new Set(["a", "strong", "b", "em", "i", "u", "s", "del", "strike", "ins", "sub", "sup", "mark", "code", "span", "br", "small", "abbr", "time", "q", "label", "cite", "kbd"]);
const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
const BASE: TextStyle = { fontSize: 16, lineHeight: 26 };
const HEADING: Record<string, TextStyle> = {
  h1: { fontSize: 26, lineHeight: 32, fontWeight: "800" },
  h2: { fontSize: 22, lineHeight: 29, fontWeight: "700" },
  h3: { fontSize: 19, lineHeight: 26, fontWeight: "700" },
  h4: { fontSize: 17, lineHeight: 24, fontWeight: "700" },
  h5: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  h6: { fontSize: 15, lineHeight: 21, fontWeight: "700" },
};

function isInline(n: HtmlNode): boolean {
  return n.type === "text" || (INLINE.has(n.tag) && !n.children.some((c) => c.type === "el" && !isInline(c)));
}

/** Normalizes an <a href>: only absolute http(s) and mailto are kept. */
function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  const h = href.trim();
  if (/^mailto:/i.test(h)) return h;
  return isWebUrl(h) ? h : null;
}

function hostOf(url: string): string | null {
  const m = /^https?:\/\/([^/?#:]+)(?::\d+)?/i.exec(url);
  return m ? m[1]!.toLowerCase() : null;
}

function renderBlocks(nodes: HtmlNode[], ctx: Ctx, key: string, pre: boolean): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let run: HtmlNode[] = [];
  const flush = () => {
    if (!run.length) return;
    const k = `${key}.t${out.length}`;
    const items = run;
    run = [];
    if (!pre && !textOf(items).replace(/[ \t\n\r\f]+/g, "").length && !items.some((n) => n.type === "el" && n.tag === "br")) return;
    out.push(
      <RNText key={k} style={[BASE, { color: ctx.t.ink, marginBottom: spacing.md }]}>
        {renderInlineRun(items, ctx, k, pre)}
      </RNText>,
    );
  };
  nodes.forEach((n, i) => {
    if (isInline(n)) {
      run.push(n);
      return;
    }
    flush();
    out.push(renderBlock(n as HtmlElement, ctx, `${key}.${i}`));
  });
  flush();
  return out;
}

function renderInlineRun(nodes: HtmlNode[], ctx: Ctx, key: string, pre: boolean): React.ReactNode[] {
  const rendered = nodes.map((n, i) => renderInline(n, ctx, `${key}.${i}`, pre));
  if (pre) return rendered;
  // trim leading/trailing collapsed whitespace of the run
  if (typeof rendered[0] === "string") rendered[0] = rendered[0].replace(/^ +/, "");
  const last = rendered.length - 1;
  if (typeof rendered[last] === "string") rendered[last] = (rendered[last] as string).replace(/ +$/, "");
  return rendered;
}

function renderInline(n: HtmlNode, ctx: Ctx, key: string, pre: boolean): React.ReactNode {
  if (n.type === "text") return pre ? n.text : n.text.replace(/[ \t\n\r\f]+/g, " ");
  const { t } = ctx;
  const kids = () => n.children.map((c, i) => renderInline(c, ctx, `${key}.${i}`, pre));
  switch (n.tag) {
    case "br":
      return "\n";
    case "strong":
    case "b":
      return <RNText key={key} style={{ fontWeight: "700" }}>{kids()}</RNText>;
    case "em":
    case "i":
    case "cite":
      return <RNText key={key} style={{ fontStyle: "italic" }}>{kids()}</RNText>;
    case "u":
    case "ins":
      return <RNText key={key} style={{ textDecorationLine: "underline" }}>{kids()}</RNText>;
    case "s":
    case "del":
    case "strike":
      return <RNText key={key} style={{ textDecorationLine: "line-through" }}>{kids()}</RNText>;
    case "sub":
    case "sup":
    case "small":
      return <RNText key={key} style={{ fontSize: 12 }}>{kids()}</RNText>;
    case "mark":
      return <RNText key={key} style={{ backgroundColor: t.scheme === "dark" ? "#5b4a00" : "#fff3a3" }}>{kids()}</RNText>;
    case "code":
    case "kbd":
      return <RNText key={key} style={{ fontFamily: MONO, fontSize: 14, backgroundColor: pre ? undefined : t.surfaceAlt }}>{kids()}</RNText>;
    case "a": {
      const href = safeHref(n.attrs.href);
      if (!href) return <RNText key={key}>{kids()}</RNText>;
      return (
        <RNText key={key} style={{ color: t.primary, textDecorationLine: "underline" }} onPress={() => ctx.onLink(href)} accessibilityRole="link" accessibilityHint="Abre o link">
          {kids()}
        </RNText>
      );
    }
    default:
      return <RNText key={key}>{kids()}</RNText>;
  }
}

function renderBlock(n: HtmlElement, ctx: Ctx, key: string): React.ReactNode {
  const { t } = ctx;
  switch (n.tag) {
    case "p":
    case "div":
    case "section":
    case "article":
    case "header":
    case "footer":
    case "figure":
    case "center":
    case "dl":
    case "dd":
    case "dt":
      return <View key={key}>{renderBlocks(n.children, ctx, key, false)}</View>;
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return (
        <RNText key={key} accessibilityRole="header" style={[HEADING[n.tag], { color: t.ink, marginTop: spacing.sm, marginBottom: spacing.sm }]}>
          {renderInlineRun(n.children.filter(isInline), ctx, key, false)}
        </RNText>
      );
    case "figcaption":
      return (
        <RNText key={key} style={{ fontSize: 13, color: t.inkMuted, textAlign: "center", marginTop: -spacing.sm, marginBottom: spacing.md }}>
          {renderInlineRun(n.children.filter(isInline), ctx, key, false)}
        </RNText>
      );
    case "ul":
    case "ol": {
      const items = n.children.filter((c): c is HtmlElement => c.type === "el" && c.tag === "li");
      const start = Number(n.attrs.start) || 1;
      return (
        <View key={key} style={{ marginBottom: spacing.md }} accessibilityRole="list">
          {items.map((li, i) => (
            <View key={`${key}.${i}`} style={{ flexDirection: "row", paddingRight: spacing.sm }}>
              <RNText style={[BASE, { color: t.inkMuted, width: n.tag === "ol" ? 28 : 18 }]}>{n.tag === "ol" ? `${start + i}.` : "•"}</RNText>
              <View style={{ flex: 1 }}>{trimLastMargin(renderBlocks(li.children, ctx, `${key}.${i}`, false))}</View>
            </View>
          ))}
        </View>
      );
    }
    case "li":
      return <View key={key}>{renderBlocks(n.children, ctx, key, false)}</View>;
    case "blockquote":
      return (
        <View key={key} style={{ borderLeftWidth: 4, borderLeftColor: t.primary, backgroundColor: t.surfaceAlt, paddingLeft: spacing.md, paddingRight: spacing.sm, paddingTop: spacing.sm, marginBottom: spacing.md, borderRadius: radius.sm }}>
          {renderBlocks(n.children, ctx, key, false)}
        </View>
      );
    case "pre":
      return (
        <ScrollView key={key} horizontal style={{ backgroundColor: t.surfaceAlt, borderRadius: radius.sm, marginBottom: spacing.md }} contentContainerStyle={{ padding: spacing.md }}>
          <RNText style={{ fontFamily: MONO, fontSize: 13, lineHeight: 19, color: t.ink }}>{n.children.map((c, i) => renderInline(c, ctx, `${key}.${i}`, true))}</RNText>
        </ScrollView>
      );
    case "hr":
      return <View key={key} style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.border, marginVertical: spacing.lg }} />;
    case "img":
      return <BlogImage key={key} el={n} ctx={ctx} />;
    case "iframe":
      return <YouTubeEmbed key={key} src={n.attrs.src} title={n.attrs.title} />;
    case "table":
      return <BlogTable key={key} el={n} ctx={ctx} />;
    default:
      // Unknown block-level element: render its content.
      return <View key={key}>{renderBlocks(n.children, ctx, key, false)}</View>;
  }
}

function trimLastMargin(nodes: React.ReactNode[]): React.ReactNode[] {
  const last = nodes[nodes.length - 1];
  if (React.isValidElement<{ style?: unknown }>(last) && last.type === RNText) {
    nodes[nodes.length - 1] = React.cloneElement(last, { style: [last.props.style, { marginBottom: 4 }] });
  }
  return nodes;
}

function BlogImage({ el, ctx }: { el: HtmlElement; ctx: Ctx }) {
  const src = absUrl(el.attrs.src) ?? "";
  const host = isWebUrl(src) ? hostOf(src) : null;
  const w0 = Number(el.attrs.width) || 0;
  const h0 = Number(el.attrs.height) || 0;
  const [ratio, setRatio] = useState(w0 && h0 ? w0 / h0 : 16 / 9);
  if (!host || !ctx.hosts.has(host)) return null;
  // width attr (px) or style="width: NN%" — never wider than the content column
  const pct = /width\s*:\s*(\d{1,3})%/i.exec(el.attrs.style ?? "")?.[1];
  const maxW = ctx.width - spacing.lg * 2;
  const w = pct ? Math.max(80, (maxW * Math.min(100, Number(pct))) / 100) : w0 ? Math.min(w0, maxW) : maxW;
  const align = el.attrs["data-align"];
  return (
    <View style={{ alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center", marginBottom: spacing.md }}>
      <Image
        source={{ uri: src }}
        style={{ width: w, aspectRatio: ratio, borderRadius: radius.md, backgroundColor: ctx.t.surfaceAlt }}
        contentFit="cover"
        transition={150}
        accessibilityLabel={el.attrs.alt || "Imagem do post"}
        accessibilityIgnoresInvertColors
        onLoad={(e) => {
          const { width, height } = e.source;
          if (width && height && !(w0 && h0)) setRatio(width / height);
        }}
      />
    </View>
  );
}

export function YouTubeEmbed({ src, title }: { src?: string; title?: string }) {
  const id = youtubeId(src);
  if (!id) return null;
  const watch = `https://www.youtube.com/watch?v=${id}`;
  return (
    <Pressable onPress={() => openExternal(watch)} accessibilityRole="link" accessibilityLabel={title ? `Assistir vídeo: ${title}` : "Assistir vídeo no YouTube"} style={{ marginBottom: spacing.md, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000" }}>
      <Image source={{ uri: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }} style={{ width: "100%", aspectRatio: 16 / 9, opacity: 0.85 }} contentFit="cover" accessibilityIgnoresInvertColors />
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <View style={{ width: 64, height: 44, borderRadius: 12, backgroundColor: "#ff0000", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="play" size={26} color="#fff" />
        </View>
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.sm, backgroundColor: "rgba(0,0,0,0.55)" }}>
        <RNText style={{ color: "#fff", fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
          {title || "Assistir no YouTube"}
        </RNText>
      </View>
    </Pressable>
  );
}

function BlogTable({ el, ctx }: { el: HtmlElement; ctx: Ctx }) {
  const rows: HtmlElement[] = [];
  const collect = (nodes: HtmlNode[]) =>
    nodes.forEach((c) => {
      if (c.type !== "el") return;
      if (c.tag === "tr") rows.push(c);
      else if (c.tag === "thead" || c.tag === "tbody" || c.tag === "tfoot") collect(c.children);
    });
  collect(el.children);
  if (!rows.length) return null;
  const { t } = ctx;
  return (
    <ScrollView horizontal style={{ marginBottom: spacing.md }} showsHorizontalScrollIndicator>
      <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: radius.sm }}>
        {rows.map((r, ri) => (
          <View key={ri} style={{ flexDirection: "row", borderTopWidth: ri ? 1 : 0, borderColor: t.border }}>
            {r.children
              .filter((c): c is HtmlElement => c.type === "el" && (c.tag === "td" || c.tag === "th"))
              .map((cell, ci) => (
                <View key={ci} style={{ width: 150, padding: spacing.sm, borderLeftWidth: ci ? 1 : 0, borderColor: t.border, backgroundColor: cell.tag === "th" ? t.surfaceAlt : undefined }}>
                  <RNText style={{ fontSize: 14, lineHeight: 20, color: t.ink, fontWeight: cell.tag === "th" ? "700" : "400" }}>
                    {renderInlineRun(flattenCell(cell.children), ctx, `tb.${ri}.${ci}`, false)}
                  </RNText>
                </View>
              ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** Table cells usually wrap content in <p>; flatten block children into inline runs separated by line breaks. */
function flattenCell(nodes: HtmlNode[]): HtmlNode[] {
  const out: HtmlNode[] = [];
  nodes.forEach((n) => {
    if (isInline(n)) out.push(n);
    else if (n.type === "el") {
      if (out.length) out.push({ type: "el", tag: "br", attrs: {}, children: [] });
      out.push(...flattenCell(n.children));
    }
  });
  return out;
}
