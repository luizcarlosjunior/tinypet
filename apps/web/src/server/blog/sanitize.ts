/**
 * Post HTML sanitizer (TipTap output) — runs server-side on every save and again on render (defense in depth).
 * Allowlist: headings, paragraphs, lists, blockquote, code/pre, hr, br, inline marks, links (http/https/mailto, plus
 * same-site paths `/…` and `#anchors`),
 * images hosted on our media storage, tables and YouTube embeds. Everything else (scripts, on* handlers, forms, svg,
 * math, styles other than a few layout properties) is removed.
 */
import DOMPurify from "isomorphic-dompurify";

export type SanitizeOptions = {
  /** Public URL prefixes of our media (e.g. `https://bucket.s3.sa-east-1.amazonaws.com/`). `<img>` outside them is dropped. */
  mediaBases: string[];
  /** App origin (e.g. `https://tinypet.com.br`): links to other hosts get `target="_blank"` + `rel`. */
  appUrl?: string;
  /** Render mode: adds `loading="lazy"` / `decoding="async"` to images and iframes. */
  forRender?: boolean;
};

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "blockquote", "pre", "code",
  "ul", "ol", "li", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "mark", "span",
  "a", "img", "figure", "figcaption", "div",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "iframe",
];

/** Attributes allowed per tag (checked after DOMPurify's own pass). */
const TAG_ATTRS: Record<string, string[]> = {
  a: ["href", "target", "rel", "title"],
  img: ["src", "alt", "width", "data-align", "style"],
  iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
  td: ["colspan", "rowspan", "colwidth"],
  th: ["colspan", "rowspan", "colwidth"],
  ol: ["start"],
  code: ["class"],
  div: ["data-youtube-video"],
  p: ["style"],
  h1: ["style"], h2: ["style"], h3: ["style"], h4: ["style"], h5: ["style"], h6: ["style"],
};
const ALL_ATTRS = Array.from(new Set(Object.values(TAG_ATTRS).flat()));

const YOUTUBE_EMBED = /^https:\/\/(?:www\.)?(?:youtube-nocookie\.com|youtube\.com)\/embed\/[A-Za-z0-9_-]{6,20}(?:\?[A-Za-z0-9_=&%.-]*)?$/;
const CSS_LENGTH = /^(?:0|auto|\d{1,4}(?:\.\d{1,3})?(?:px|%|em|rem))$/;

function filterStyle(tag: string, style: string): string {
  const out: string[] = [];
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim().toLowerCase();
    if (!value || /[()\\<>"'`]/.test(value)) continue;
    if (tag === "img") {
      if ((prop === "width" || prop === "max-width") && CSS_LENGTH.test(value)) out.push(`${prop}: ${value}`);
      else if (prop === "float" && /^(left|right|none)$/.test(value)) out.push(`float: ${value}`);
      else if (/^margin(-(left|right|top|bottom))?$/.test(prop) && value.split(/\s+/).length <= 4 && value.split(/\s+/).every((v) => CSS_LENGTH.test(v))) out.push(`${prop}: ${value}`);
    } else if (prop === "text-align" && /^(left|right|center|justify)$/.test(value)) {
      out.push(`text-align: ${value}`);
    }
  }
  return out.join("; ");
}

function normalizeBases(bases: string[]): string[] {
  return bases.filter(Boolean).map((b) => (b.endsWith("/") ? b : `${b}/`));
}

/** True when `url` is an absolute http(s) URL under one of our media bases (after URL normalization). */
export function isOurMediaUrl(url: string | null | undefined, mediaBases: string[]): boolean {
  if (!url) return false;
  let href: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.username || u.password) return false;
    href = u.href;
  } catch {
    return false;
  }
  return normalizeBases(mediaBases).some((b) => href.startsWith(b));
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export function sanitizePostHtml(dirty: string, opts: SanitizeOptions): string {
  if (!dirty) return "";
  const bases = normalizeBases(opts.mediaBases);
  const appHost = hostOf(opts.appUrl);

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const el = node as Element;
    if (!el.tagName) return;
    const tag = el.tagName.toLowerCase();
    const allowed = TAG_ATTRS[tag] ?? [];
    for (const attr of Array.from(el.attributes)) {
      if (!allowed.includes(attr.name.toLowerCase())) el.removeAttribute(attr.name);
    }

    if (el.hasAttribute("style")) {
      const style = filterStyle(tag, el.getAttribute("style") ?? "");
      if (style) el.setAttribute("style", style);
      else el.removeAttribute("style");
    }

    if (tag === "a") {
      const href = el.getAttribute("href") ?? "";
      let external = true;
      if (/^mailto:/i.test(href)) external = false;
      else if (/^(\/(?![\/\\])|#)[^\s\\]*$/.test(href)) external = false; // same-site path or anchor
      else {
        try {
          const u = new URL(href);
          if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol");
          external = !appHost || u.host.toLowerCase() !== appHost;
        } catch {
          el.removeAttribute("href");
          external = false;
        }
      }
      if (external) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer nofollow");
      } else {
        el.removeAttribute("target");
        el.removeAttribute("rel");
      }
      return;
    }

    if (tag === "img") {
      const src = el.getAttribute("src") ?? "";
      let ok = false;
      try {
        const href = new URL(src).href;
        ok = (href.startsWith("https://") || href.startsWith("http://")) && bases.some((b) => href.startsWith(b));
      } catch {
        ok = false;
      }
      if (!ok) {
        el.parentNode?.removeChild(el);
        return;
      }
      const w = el.getAttribute("width");
      if (w && !/^\d{1,4}$/.test(w)) el.removeAttribute("width");
      const align = el.getAttribute("data-align");
      if (align && !/^(left|center|right)$/.test(align)) el.removeAttribute("data-align");
      if (opts.forRender) {
        el.setAttribute("loading", "lazy");
        el.setAttribute("decoding", "async");
      }
      return;
    }

    if (tag === "iframe") {
      const src = el.getAttribute("src") ?? "";
      if (!YOUTUBE_EMBED.test(src)) {
        el.parentNode?.removeChild(el);
        return;
      }
      for (const a of ["width", "height", "frameborder"]) {
        const v = el.getAttribute(a);
        if (v && !/^\d{1,4}$/.test(v)) el.removeAttribute(a);
      }
      el.setAttribute("allow", "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
      el.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      el.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation allow-popups");
      if (opts.forRender) el.setAttribute("loading", "lazy");
      return;
    }

    if (tag === "code") {
      const cls = el.getAttribute("class");
      if (cls && !/^language-[a-z0-9_+-]{1,30}$/i.test(cls)) el.removeAttribute("class");
    }
    if (tag === "ol") {
      const start = el.getAttribute("start");
      if (start && !/^\d{1,5}$/.test(start)) el.removeAttribute("start");
    }
    if (tag === "td" || tag === "th") {
      for (const a of ["colspan", "rowspan", "colwidth"]) {
        const v = el.getAttribute(a);
        if (v && !/^\d{1,4}(,\d{1,4})*$/.test(v)) el.removeAttribute(a);
      }
    }
  });

  try {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: [...ALL_ATTRS, "loading", "decoding", "referrerpolicy", "sandbox"],
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/(?![\/\\])|#)/i,
      // Non-URL attributes: without this DOMPurify tests their values against ALLOWED_URI_REGEXP too.
      ADD_URI_SAFE_ATTR: ["width", "height", "start", "colspan", "rowspan", "colwidth", "data-align", "data-youtube-video", "frameborder", "allow", "allowfullscreen", "target", "rel"],
      FORBID_TAGS: ["style", "script", "form", "input", "button", "textarea", "select", "svg", "math", "object", "embed", "link", "meta", "base"],
      KEEP_CONTENT: true,
    }) as unknown as string;
  } finally {
    DOMPurify.removeHook("afterSanitizeAttributes");
  }
}
