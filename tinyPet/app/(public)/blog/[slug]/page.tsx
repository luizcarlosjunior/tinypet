import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { Clock } from "lucide-react";
import { getUser } from "@/server";
import { isBlogEditor } from "@/server/blog/auth";
import { getPublicPost, relatedPosts } from "@/server/blog/posts";
import { excerpt } from "@/server/blog/utils";
import { appUrl } from "@/lib/server-api";
import { fmtDate } from "@/lib/format";
import { JsonLd } from "@/components/public/json-ld";
import { Avatar } from "@/components/ui/avatar";
import { BlogImage } from "@/components/blog/blog-image";
import { PostBody } from "@/components/blog/post-body";
import { HeartButton } from "@/components/blog/heart-button";
import { ShareButtons } from "@/components/blog/share-buttons";
import { Comments } from "@/components/blog/comments";
import { ViewBeacon } from "@/components/blog/view-beacon";
import { PostGrid } from "@/components/blog/post-card";

type Props = { params: { slug: string }; searchParams: { preview?: string } };

/** Viewer-dependent (hearted state, preview for blog editors): rendered per request. */
export const dynamic = "force-dynamic";

const load = cache(async (slug: string, previewParam: boolean) => {
  const user = await getUser();
  const preview = previewParam && isBlogEditor(user);
  const r = await getPublicPost(slug, { viewerId: user?.id, preview });
  return { r, user, preview };
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { r, preview } = await load(params.slug, searchParams.preview === "1");
  if (!r || "redirectTo" in r) return { title: "Post não encontrado" };
  const p = r.post;
  const title = p.seoTitle || p.title;
  const description = p.seoDescription || p.summary || excerpt(p.content, 170);
  const url = appUrl(`/blog/${p.slug}`);
  const image = p.coverOgImage || p.coverImageRect;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: preview || p.status !== "PUBLISHED" ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "tinyPet",
      locale: "pt_BR",
      publishedTime: p.publishDate?.toISOString(),
      modifiedTime: p.updatedAt.toISOString(),
      authors: p.author?.name ? [p.author.name] : undefined,
      tags: p.tags,
      images: image ? [{ url: image, alt: p.coverAlt ?? p.title, ...(p.coverOgImage ? { width: 1200, height: 630 } : {}) }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function BlogPostPage({ params, searchParams }: Props) {
  const { r, user, preview } = await load(params.slug, searchParams.preview === "1");
  if (!r) notFound();
  if ("redirectTo" in r) permanentRedirect(`/blog/${encodeURIComponent(r.redirectTo)}${preview ? "?preview=1" : ""}`);
  const p = r.post;
  const url = appUrl(`/blog/${p.slug}`);
  const related = await relatedPosts(p.id, p.categories.map((c) => c.id), 3);
  const primary = p.categories.find((c) => !c.parentId) ?? p.categories[0];

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#post`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: p.title.slice(0, 110),
    description: p.seoDescription || p.summary || excerpt(p.content, 170),
    image: [p.coverImageRect, p.coverImageSquare, p.coverOgImage].filter(Boolean),
    datePublished: p.publishDate?.toISOString(),
    dateModified: p.updatedAt.toISOString(),
    author: p.author ? { "@type": "Person", name: p.author.name } : { "@type": "Organization", name: "tinyPet" },
    publisher: { "@type": "Organization", name: "tinyPet", url: appUrl("/") },
    articleSection: primary?.name,
    keywords: p.tags.length ? p.tags.join(", ") : undefined,
    timeRequired: `PT${p.readingMinutes}M`,
    inLanguage: "pt-BR",
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: p.heartsCount },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: p.commentsCount },
    ],
  };

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      {!preview && <JsonLd data={jsonLd} />}
      <ViewBeacon postId={p.id} disabled={preview || p.status !== "PUBLISHED"} />
      {preview && (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Pré-visualização ({p.status}) — visível só para a equipe do blog.
        </p>
      )}

      <header className="space-y-4">
        <nav aria-label="Trilha" className="text-sm text-[var(--muted)]">
          <Link href="/blog" className="hover:underline">
            Blog
          </Link>
          {primary && (
            <>
              {" / "}
              <Link href={`/blog/categoria/${primary.slug}`} className="hover:underline">
                {primary.name}
              </Link>
            </>
          )}
        </nav>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{p.title}</h1>
        {p.summary && <p className="text-lg text-[var(--muted)]">{p.summary}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
          {p.author && (
            <span className="inline-flex items-center gap-2">
              <Avatar src={p.author.avatarUrl} name={p.author.name} size={28} />
              <span className="font-medium text-[var(--fg)]">{p.author.name}</span>
            </span>
          )}
          {p.publishDate && <time dateTime={p.publishDate.toISOString()}>{fmtDate(p.publishDate, "d 'de' MMMM 'de' yyyy")}</time>}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-4 w-4" aria-hidden /> {p.readingMinutes} min de leitura
          </span>
        </div>
      </header>

      {p.coverImageRect && (
        <figure className="relative -mx-4 aspect-video overflow-hidden bg-ink-100 sm:mx-0 sm:rounded-2xl dark:bg-ink-800">
          <BlogImage src={p.coverImageRect} alt={p.coverAlt ?? ""} sizes="(min-width: 768px) 768px, 100vw" priority />
        </figure>
      )}

      <PostBody html={p.content} />

      {p.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tags">
          {p.tags.map((t) => (
            <li key={t}>
              <Link href={`/blog/tag/${encodeURIComponent(t)}`} className="inline-flex rounded-full bg-ink-100 px-3 py-1 text-xs hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700">
                #{t}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-4 border-y py-4 sm:flex-row sm:items-center sm:justify-between">
        <HeartButton endpoint={`/blog/posts/${p.id}/heart`} initialHearted={p.viewerHearted} initialCount={p.heartsCount} loggedIn={!!user} nextPath={`/blog/${p.slug}`} />
        <ShareButtons url={url} title={p.title} />
      </div>

      {p.status === "PUBLISHED" && <Comments postId={p.id} slug={p.slug} commentsEnabled={p.commentsEnabled} initialCount={p.commentsCount} />}

      {related.length > 0 && (
        <section aria-labelledby="relacionados" className="space-y-4 border-t pt-8">
          <h2 id="relacionados" className="text-xl font-bold">
            Leia também
          </h2>
          <PostGrid posts={related} />
        </section>
      )}
    </article>
  );
}
