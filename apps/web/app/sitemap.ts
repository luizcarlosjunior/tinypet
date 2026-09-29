import type { MetadataRoute } from "next";
import { prisma } from "@tinypet/db";
import { publishedWhere } from "@/server/blog/posts";
import { blogAppUrl } from "@/server/blog/auth";

export const revalidate = 3600;

/** Public sitemap: main public pages, blog posts and active blog categories. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = blogAppUrl();
  const [posts, categories] = await Promise.all([
    prisma.blogPost.findMany({ where: publishedWhere(), select: { slug: true, updatedAt: true }, orderBy: { publishDate: "desc" }, take: 5000 }).catch(() => []),
    prisma.blogCategory.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }).catch(() => []),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/buscar`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/cursos`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((c) => ({ url: `${base}/blog/categoria/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
