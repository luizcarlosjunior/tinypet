/**
 * Tiny HTML → tree parser for the blog's *server-sanitized* post content (docs/blog-contract.md → "Content & media
 * rules"). It is not a general HTML parser: it understands the limited TipTap tag set, tolerates unclosed tags and
 * drops comments/unknown markup. Rendering (and URL allowlisting) lives in `components/blog/BlogHtml.tsx`.
 */

export type HtmlText = { type: "text"; text: string };
export type HtmlElement = { type: "el"; tag: string; attrs: Record<string, string>; children: HtmlNode[] };
export type HtmlNode = HtmlText | HtmlElement;

const VOID = new Set(["br", "hr", "img", "source", "col", "wbr", "input", "meta", "link"]);
/** Tags whose content is dropped entirely (should never reach us after sanitizing, but be defensive). */
const DROP = new Set(["script", "style", "noscript", "template", "svg", "math", "form", "head", "title", "object", "embed"]);
/** Opening one of these implicitly closes an open <p> (like browsers do). */
const CLOSES_P = new Set(["p", "div", "ul", "ol", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "table", "hr", "figure"]);

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™", deg: "°", ordm: "º", ordf: "ª",
  aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í", oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú",
  atilde: "ã", Atilde: "Ã", otilde: "õ", Otilde: "Õ", acirc: "â", Acirc: "Â", ecirc: "ê", Ecirc: "Ê", ocirc: "ô", Ocirc: "Ô",
  agrave: "à", Agrave: "À", ccedil: "ç", Ccedil: "Ç", uuml: "ü", Uuml: "Ü", times: "×", euro: "€",
};

export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    return NAMED[e] ?? m;
  });
}

function parseAttrs(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1]!.toLowerCase();
    if (name.startsWith("on")) continue;
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

export function parseHtml(html: string): HtmlNode[] {
  const root: HtmlElement = { type: "el", tag: "#root", attrs: {}, children: [] };
  const stack: HtmlElement[] = [root];
  const top = () => stack[stack.length - 1]!;
  let dropDepth = 0;
  let dropTag = "";
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/\s*([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+|<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, closeTag, openTag, rawAttrs, text] = m;
    if (dropDepth) {
      if (openTag?.toLowerCase() === dropTag && !/\/\s*$/.test(rawAttrs ?? "")) dropDepth++;
      else if (closeTag?.toLowerCase() === dropTag) dropDepth--;
      continue;
    }
    if (text !== undefined) {
      top().children.push({ type: "text", text: decodeEntities(text) });
    } else if (openTag) {
      const tag = openTag.toLowerCase();
      const selfClosing = /\/\s*$/.test(rawAttrs ?? "");
      if (DROP.has(tag)) {
        if (!selfClosing) {
          dropDepth = 1;
          dropTag = tag;
        }
        continue;
      }
      if (CLOSES_P.has(tag) && top().tag === "p") stack.pop();
      if (tag === "li") {
        const i = stack.map((e) => e.tag).lastIndexOf("li");
        const list = Math.max(stack.map((e) => e.tag).lastIndexOf("ul"), stack.map((e) => e.tag).lastIndexOf("ol"));
        if (i > list && i > 0) stack.length = i;
      }
      const el: HtmlElement = { type: "el", tag, attrs: parseAttrs((rawAttrs ?? "").replace(/\/\s*$/, "")), children: [] };
      top().children.push(el);
      if (!VOID.has(tag) && !selfClosing) stack.push(el);
    } else if (closeTag) {
      const tag = closeTag.toLowerCase();
      if (tag === "p" && !stack.some((e) => e.tag === "p")) continue;
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i]!.tag === tag) {
          stack.length = i;
          break;
        }
      }
    }
  }
  return root.children;
}

/** Plain text of a node tree (used for accessibility labels / empty checks). */
export function textOf(nodes: HtmlNode[]): string {
  return nodes.map((n) => (n.type === "text" ? n.text : n.tag === "br" ? "\n" : textOf(n.children))).join("");
}

/** YouTube video id from an embed/watch/short URL, or null. */
export function youtubeId(src: string | undefined): string | null {
  if (!src) return null;
  const m = /^(?:https?:)?\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/i.exec(src.trim());
  return m ? m[1]! : null;
}
