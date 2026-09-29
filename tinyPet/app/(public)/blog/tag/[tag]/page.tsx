import type { Metadata } from "next";
import Link from "next/link";
import { appUrl } from "@/lib/server-api";
import { Empty } from "@/components/ui";
import { PostGrid } from "@/components/blog/post-card";
import { BlogPagination } from "@/components/blog/blog-nav";
import { listPublicPosts } from "@/server/blog/posts";

export const revalidate = 60;

function tagOf(raw: string) {
  try {
    return decodeURIComponent(raw).slice(0, 60);
  } catch {
    return raw.slice(0, 60);
  }
}

export async function generateMetadata({ params }: { params: { tag: string } }): Promise<Metadata> {
  const tag = tagOf(params.tag);
  return { title: `#${tag} · Blog`, description: `Posts com a tag ${tag} no blog tinyPet.`, alternates: { canonical: appUrl(`/blog/tag/${encodeURIComponent(tag)}`) }, robots: { index: false, follow: true } };
}

export default async function TagPage({ params, searchParams }: { params: { tag: string }; searchParams: { page?: string } }) {
  const tag = tagOf(params.tag);
  const page = Math.min(1000, Math.max(1, Number(searchParams.page) || 1));
  const list = await listPublicPosts({ tag, page, pageSize: 12 });
  return (
    <div className="space-y-6">
      <nav aria-label="Trilha" className="text-sm text-[var(--muted)]">
        <Link href="/blog" className="hover:underline">
          Blog
        </Link>
        {" / "}
        <span aria-current="page">#{tag}</span>
      </nav>
      <h1 className="text-3xl font-extrabold tracking-tight">#{tag}</h1>
      {list.items.length ? <PostGrid posts={list.items} headingLevel={2} /> : <Empty title="Nenhum post com esta tag" />}
      <BlogPagination page={page} pageSize={12} total={list.meta.total} basePath={`/blog/tag/${encodeURIComponent(tag)}`} />
    </div>
  );
}
