/**
 * Comment text rendering (pure, client-safe). Comments are PLAIN TEXT: never HTML.
 * Rendered escaped, with line breaks and autolinked http(s) URLs (`rel="nofollow ugc noopener"`).
 */

export const COMMENT_MIN = 2;
export const COMMENT_MAX = 2000;
export const COMMENT_MAX_LINKS = 2;
export const COMMENT_LINK_REL = "nofollow ugc noopener";

export type CommentToken = { type: "text"; value: string } | { type: "link"; href: string; text: string } | { type: "br" };

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TRAILING = /[.,;:!?)\]}'"»]+$/;

/** Normalizes a comment body: CRLF → LF, trims, collapses 3+ blank lines, strips control chars. */
export function normalizeCommentBody(body: string): string {
  return body
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findLinks(text: string): { start: number; end: number; href: string }[] {
  const out: { start: number; end: number; href: string }[] = [];
  for (const m of text.matchAll(URL_RE)) {
    let href = m[0];
    const trail = href.match(TRAILING);
    if (trail) href = href.slice(0, -trail[0].length);
    // keep a closing paren when the URL itself opened one: https://x.com/a_(b)
    if (m[0].slice(href.length).startsWith(")") && href.includes("(") && !href.endsWith(")")) href += ")";
    try {
      const u = new URL(href);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    } catch {
      continue;
    }
    out.push({ start: m.index!, end: m.index! + href.length, href });
  }
  return out;
}

export function countLinks(text: string): number {
  return findLinks(text).length;
}

/** Validation error message (pt-BR) or null when the body is acceptable. */
export function commentBodyError(body: string): string | null {
  if (body.length < COMMENT_MIN) return `O comentário precisa ter pelo menos ${COMMENT_MIN} caracteres`;
  if (body.length > COMMENT_MAX) return `O comentário pode ter até ${COMMENT_MAX} caracteres`;
  if (countLinks(body) > COMMENT_MAX_LINKS) return `Use no máximo ${COMMENT_MAX_LINKS} links por comentário`;
  return null;
}

/** Splits text into text / link / line-break tokens (at most `maxLinks` become links; the rest stays text). */
export function tokenizeComment(text: string, maxLinks = COMMENT_MAX_LINKS): CommentToken[] {
  const tokens: CommentToken[] = [];
  const pushText = (s: string) => {
    const lines = s.split("\n");
    lines.forEach((line, i) => {
      if (i > 0) tokens.push({ type: "br" });
      if (line) tokens.push({ type: "text", value: line });
    });
  };
  let pos = 0;
  let links = 0;
  for (const l of findLinks(text)) {
    if (links >= maxLinks) break;
    if (l.start > pos) pushText(text.slice(pos, l.start));
    tokens.push({ type: "link", href: l.href, text: l.href.replace(/^https?:\/\//i, "").slice(0, 80) + (l.href.replace(/^https?:\/\//i, "").length > 80 ? "…" : "") });
    pos = l.end;
    links++;
  }
  if (pos < text.length) pushText(text.slice(pos));
  return tokens;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** HTML string of a comment (escaped text, `<br>`, autolinks). Used where React rendering is not available. */
export function renderCommentHtml(text: string, maxLinks = COMMENT_MAX_LINKS): string {
  return tokenizeComment(text, maxLinks)
    .map((t) => {
      if (t.type === "br") return "<br>";
      if (t.type === "text") return escapeHtml(t.value);
      return `<a href="${escapeHtml(t.href)}" rel="${COMMENT_LINK_REL}" target="_blank">${escapeHtml(t.text)}</a>`;
    })
    .join("");
}
