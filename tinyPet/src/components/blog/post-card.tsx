import Link from "next/link";
import { Heart, MessageCircle, Clock } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BlogImage } from "./blog-image";

export type PostCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImageRect: string | null;
  coverAlt: string | null;
  publishDate: Date | string | null;
  readingMinutes: number;
  categories: { name: string; slug: string }[];
  author: { name: string } | null;
  heartsCount: number;
  commentsCount: number;
};

export function PostCard({ post, variant = "default", headingLevel = 3 }: { post: PostCardData; variant?: "default" | "featured" | "compact"; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const featured = variant === "featured";
  return (
    <article className={cn("group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--card)] shadow-sm transition hover:shadow-md", featured && "md:flex-row")}>
      <div className={cn("relative aspect-video w-full shrink-0 overflow-hidden bg-brand-50 dark:bg-ink-800", featured && "md:w-3/5")}>
        {post.coverImageRect ? (
          <BlogImage src={post.coverImageRect} alt={post.coverAlt ?? ""} sizes={featured ? "(min-width: 768px) 60vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} className="transition duration-300 group-hover:scale-[1.02]" priority={featured} />
        ) : (
          <div aria-hidden className="flex h-full items-center justify-center text-4xl">🐾</div>
        )}
      </div>
      <div className={cn("flex flex-1 flex-col gap-2 p-4", featured && "md:justify-center md:p-6")}>
        {post.categories[0] && (
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{post.categories[0].name}</p>
        )}
        <H className={cn("font-bold leading-snug", featured ? "text-xl md:text-2xl" : "text-lg")}>
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 focus:outline-none focus-visible:underline">
            {post.title}
          </Link>
        </H>
        {variant !== "compact" && post.summary && <p className={cn("text-sm text-[var(--muted)]", featured ? "line-clamp-4" : "line-clamp-3")}>{post.summary}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-[var(--muted)]">
          {post.publishDate && <time dateTime={new Date(post.publishDate).toISOString()}>{fmtDate(post.publishDate, "d 'de' MMM yyyy")}</time>}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {post.readingMinutes} min
          </span>
          <span className="inline-flex items-center gap-1" aria-label={`${post.heartsCount} corações`}>
            <Heart className="h-3.5 w-3.5" aria-hidden />
            {post.heartsCount}
          </span>
          <span className="inline-flex items-center gap-1" aria-label={`${post.commentsCount} comentários`}>
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            {post.commentsCount}
          </span>
        </div>
      </div>
    </article>
  );
}

export function PostGrid({ posts, headingLevel = 3 }: { posts: PostCardData[]; headingLevel?: 2 | 3 }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <li key={p.id} className="flex">
          <div className="w-full">
            <PostCard post={p} headingLevel={headingLevel} />
          </div>
        </li>
      ))}
    </ul>
  );
}
