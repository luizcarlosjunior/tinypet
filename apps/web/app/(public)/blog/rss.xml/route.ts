import { prisma } from "@tinypet/db";
import { publishedWhere } from "@/server/blog/posts";
import { excerpt } from "@/server/blog/utils";
import { blogAppUrl } from "@/server/blog/auth";

export const revalidate = 600;

function esc(s: string) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** RSS 2.0 feed of the 30 latest published posts. */
export async function GET() {
  const base = blogAppUrl();
  const posts = await prisma.blogPost.findMany({
    where: publishedWhere(),
    orderBy: { publishDate: "desc" },
    take: 30,
    select: { slug: true, title: true, summary: true, content: true, publishDate: true, coverImageRect: true, author: { select: { name: true } }, categories: { select: { category: { select: { name: true } } } } },
  });
  const items = posts
    .map((p) => {
      const link = `${base}/blog/${encodeURIComponent(p.slug)}`;
      return [
        "<item>",
        `<title>${esc(p.title)}</title>`,
        `<link>${esc(link)}</link>`,
        `<guid isPermaLink="true">${esc(link)}</guid>`,
        p.publishDate ? `<pubDate>${p.publishDate.toUTCString()}</pubDate>` : "",
        `<description>${esc(p.summary || excerpt(p.content, 300))}</description>`,
        p.author?.name ? `<dc:creator>${esc(p.author.name)}</dc:creator>` : "",
        ...p.categories.map((c) => `<category>${esc(c.category.name)}</category>`),
        p.coverImageRect ? `<enclosure url="${esc(p.coverImageRect)}" type="${/\.png$/i.test(p.coverImageRect) ? "image/png" : /\.jpe?g$/i.test(p.coverImageRect) ? "image/jpeg" : /\.gif$/i.test(p.coverImageRect) ? "image/gif" : "image/webp"}" length="0" />` : "",
        "</item>",
      ]
        .filter(Boolean)
        .join("");
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>Blog tinyPet</title>
<link>${esc(`${base}/blog`)}</link>
<atom:link href="${esc(`${base}/blog/rss.xml`)}" rel="self" type="application/rss+xml" />
<description>Saúde, comportamento e bem-estar para quem ama pets.</description>
<language>pt-BR</language>
${posts[0]?.publishDate ? `<lastBuildDate>${posts[0].publishDate.toUTCString()}</lastBuildDate>` : ""}
${items}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600, s-maxage=600" } });
}
