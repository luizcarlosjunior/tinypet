import { describe, expect, it } from "vitest";
import { isOurMediaUrl, sanitizePostHtml } from "./sanitize";

const opts = { mediaBases: ["https://cdn.tinypet.test/blog/"], appUrl: "https://tinypet.test" };
const s = (html: string, o: Partial<typeof opts> & { forRender?: boolean } = {}) => sanitizePostHtml(html, { ...opts, ...o });

describe("sanitizePostHtml", () => {
  it("keeps the allowed structure", () => {
    const html = "<h2>Título</h2><p>Um <strong>texto</strong> <em>com</em> <u>marcas</u> <s>x</s> <mark>y</mark> H<sub>2</sub>O</p><ul><li>a</li></ul><ol start=\"3\"><li>b</li></ol><blockquote><p>q</p></blockquote><pre><code class=\"language-js\">x()</code></pre><hr><table><tbody><tr><th colspan=\"2\">h</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>";
    expect(s(html)).toBe(html.replace("<hr>", "<hr>"));
  });

  it("strips scripts, event handlers and javascript: URLs", () => {
    const out = s('<p onclick="alert(1)">oi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src="https://cdn.tinypet.test/blog/a.webp" onerror="alert(1)"><a href="JaVaScRiPt:alert(1)">y</a>');
    expect(out).not.toMatch(/script|onclick|onerror|javascript/i);
    expect(out).toContain("<p>oi</p>");
    expect(out).toContain('<img src="https://cdn.tinypet.test/blog/a.webp">');
  });

  it("removes forms, svg, style tags and inline styles other than the allowed ones", () => {
    const out = s('<form action="/x"><input name="a"><button>go</button></form><svg><circle/></svg><style>p{}</style><p style="color:red;text-align:center">t</p><div style="position:fixed">d</div>');
    expect(out).not.toMatch(/form|input|button|svg|circle|<style|color|position/i);
    expect(out).toContain('<p style="text-align: center">t</p>');
  });

  it("allows only our media host for images and limits img style", () => {
    expect(s('<img src="https://evil.test/blog/a.png">')).toBe("");
    expect(s('<img src="http://cdn.tinypet.test/blog/a.png">')).toBe("");
    expect(s('<img src="https://cdn.tinypet.test/other/a.png">')).toBe("");
    expect(s('<img src="https://cdn.tinypet.test/blog/../x.png">')).toBe("");
    expect(s('<img src="https://cdn.tinypet.test.evil.com/blog/a.png">')).toBe("");
    const ok = s('<img src="https://cdn.tinypet.test/blog/a.webp" alt="Cão" width="640" data-align="center" style="width: 50%; float: left; margin: 0 1rem; background: url(x)" title="x">');
    expect(ok).toBe('<img src="https://cdn.tinypet.test/blog/a.webp" alt="Cão" width="640" data-align="center" style="width: 50%; float: left; margin: 0 1rem">');
    expect(s('<img src="data:image/png;base64,AAAA">')).toBe("");
  });

  it("adds rel/target to external links only and drops non-http protocols", () => {
    expect(s('<a href="https://example.com/x">e</a>')).toBe('<a href="https://example.com/x" target="_blank" rel="noopener noreferrer nofollow">e</a>');
    expect(s('<a href="https://tinypet.test/blog/x" target="_blank" rel="opener">i</a>')).toBe('<a href="https://tinypet.test/blog/x">i</a>');
    expect(s('<a href="mailto:oi@tinypet.test">m</a>')).toBe('<a href="mailto:oi@tinypet.test">m</a>');
    expect(s('<a href="ftp://x.test/a">f</a>')).toBe("<a>f</a>");
    expect(s('<a href="/buscar?q=1" target="_blank">p</a><a href="#sec">h</a>')).toBe('<a href="/buscar?q=1">p</a><a href="#sec">h</a>');
    expect(s('<a href="//evil.test/x">pr</a>')).toBe("<a>pr</a>");
    expect(s('<a href="/\\evil.test">bs</a>')).toBe("<a>bs</a>");
    expect(s('<a href="data:text/html,<script>alert(1)</script>">d</a>')).toBe("<a>d</a>");
  });

  it("allows YouTube embeds only", () => {
    const yt = s('<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="640" height="360" allowfullscreen="true" onload="x()"></iframe></div>');
    expect(yt).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(yt).toContain("sandbox=");
    expect(yt).not.toContain("onload");
    expect(s('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')).toContain("youtube.com/embed/");
    expect(s('<iframe src="https://evil.test/embed/dQw4w9WgXcQ"></iframe>')).toBe("");
    expect(s('<iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></iframe>')).toBe("");
    expect(s('<iframe srcdoc="<script>alert(1)</script>" src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')).not.toContain("srcdoc");
  });

  it("strips data-* and class attributes except the allowed ones", () => {
    expect(s('<p class="fixed inset-0" data-x="1" id="a">t</p>')).toBe("<p>t</p>");
    expect(s('<code class="evil fixed">x</code>')).toBe("<code>x</code>");
  });

  it("adds lazy loading in render mode", () => {
    expect(s('<img src="https://cdn.tinypet.test/blog/a.webp">', { forRender: true })).toBe('<img src="https://cdn.tinypet.test/blog/a.webp" loading="lazy" decoding="async">');
  });

  it("does not leak hooks between calls", () => {
    s('<img src="https://cdn.tinypet.test/blog/a.webp">');
    s('<img src="https://cdn.tinypet.test/blog/a.webp">');
    expect(s("<p>x</p>")).toBe("<p>x</p>");
  });
});

describe("isOurMediaUrl", () => {
  it("checks the normalized prefix", () => {
    expect(isOurMediaUrl("https://cdn.tinypet.test/blog/a.webp", opts.mediaBases)).toBe(true);
    expect(isOurMediaUrl("https://cdn.tinypet.test/blog/../a.webp", opts.mediaBases)).toBe(false);
    expect(isOurMediaUrl("https://user:pw@cdn.tinypet.test/blog/a.webp", opts.mediaBases)).toBe(false);
    expect(isOurMediaUrl("javascript:alert(1)", opts.mediaBases)).toBe(false);
    expect(isOurMediaUrl(null, opts.mediaBases)).toBe(false);
  });
});
