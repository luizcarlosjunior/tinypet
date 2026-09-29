import { describe, expect, it } from "vitest";
import { commentBodyError, countLinks, normalizeCommentBody, renderCommentHtml, tokenizeComment } from "./text";

describe("comment text", () => {
  it("escapes HTML", () => {
    expect(renderCommentHtml(`<script>alert("x")</script> & 'y'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
    expect(renderCommentHtml('<img src=x onerror=alert(1)>')).not.toContain("<img");
  });

  it("keeps line breaks", () => {
    expect(renderCommentHtml("a\nb\n\nc")).toBe("a<br>b<br><br>c");
  });

  it("autolinks http(s) URLs with nofollow ugc and trims trailing punctuation", () => {
    expect(renderCommentHtml("veja https://tinypet.test/a?b=1&c=2.")).toBe('veja <a href="https://tinypet.test/a?b=1&amp;c=2" rel="nofollow ugc noopener" target="_blank">tinypet.test/a?b=1&amp;c=2</a>.');
    expect(renderCommentHtml("(https://x.test/p)")).toBe('(<a href="https://x.test/p" rel="nofollow ugc noopener" target="_blank">x.test/p</a>)');
  });

  it("never links javascript: or other protocols", () => {
    expect(renderCommentHtml("javascript:alert(1) ftp://x.test")).toBe("javascript:alert(1) ftp://x.test");
  });

  it("does not break out of the href attribute", () => {
    const out = renderCommentHtml('https://x.test/"onmouseover="alert(1)');
    expect(out).toContain('href="https://x.test/"');
    expect(out).not.toMatch(/href="[^"]*onmouseover/);
  });

  it("limits links", () => {
    const body = "https://a.test https://b.test https://c.test";
    expect(countLinks(body)).toBe(3);
    expect(commentBodyError(body)).toMatch(/no máximo 2 links/);
    expect(tokenizeComment(body).filter((t) => t.type === "link")).toHaveLength(2);
  });

  it("validates length and normalizes", () => {
    expect(commentBodyError("a")).toMatch(/pelo menos/);
    expect(commentBodyError("x".repeat(2001))).toMatch(/até 2000/);
    expect(commentBodyError("ok")).toBeNull();
    expect(normalizeCommentBody("  oi\r\n\r\n\r\n\r\ntchau‮  ")).toBe("oi\n\ntchau");
  });
});
