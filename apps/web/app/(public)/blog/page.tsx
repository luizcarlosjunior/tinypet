import type { Metadata } from "next";
import Link from "next/link";
import { Rss, Search } from "lucide-react";
import { appUrl } from "@/lib/server-api";
import { Empty } from "@/components/ui";
import { PostCard, PostGrid } from "@/components/blog/post-card";
import { BlogPagination, CategoryChips } from "@/components/blog/blog-nav";
import { categoryTree } from "@/server/blog/categories";
import { listPublicPosts } from "@/server/blog/posts";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog",
  description: "Dicas de saúde, comportamento, nutrição e bem-estar para cães, gatos e outros pets — do time tinyPet.",
  alternates: { canonical: appUrl("/blog"), types: { "application/rss+xml": appUrl("/blog/rss.xml") } },
  openGraph: { title: "Blog tinyPet", description: "Dicas para cuidar melhor do seu pet.", type: "website", url: appUrl("/blog") },
};

export default async function BlogHome({ searchParams }: { searchParams: { page?: string; q?: string } }) {
  const page = Math.min(1000, Math.max(1, Number(searchParams.page) || 1));
  const q = searchParams.q?.trim().slice(0, 200) || undefined;
  const [featured, latest, tree] = await Promise.all([
    page === 1 && !q ? listPublicPosts({ featured: "1", page: 1, pageSize: 1 }) : null,
    listPublicPosts({ page, pageSize: 12, q }),
    categoryTree({ publicOnly: true }),
  ]);
  const hero = featured?.items[0] ?? null;
  const items = latest.items.filter((p) => p.id !== hero?.id);
  const chips = tree.filter((c) => c.postCount > 0 || c.children.some((x) => x.postCount > 0));

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Blog tinyPet</h1>
            <p className="mt-1 text-[var(--muted)]">Saúde, comportamento e bem-estar para quem ama pets.</p>
          </div>
          <Link href="/blog/rss.xml" className="btn-ghost text-sm" prefetch={false}>
            <Rss className="h-4 w-4" aria-hidden /> RSS
          </Link>
        </div>
        <form role="search" action="/blog" className="relative max-w-md">
          <label htmlFor="blog-q" className="sr-only">
            Buscar no blog
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
          <input id="blog-q" name="q" defaultValue={q} placeholder="Buscar no blog…" className="input h-10 pl-9" />
        </form>
        <CategoryChips categories={chips} />
      </header>

      {hero && (
        <section aria-label="Destaque">
          <PostCard post={hero} variant="featured" headingLevel={2} />
        </section>
      )}

      <section aria-labelledby="ultimos" className="space-y-4">
        <h2 id="ultimos" className="text-xl font-bold">
          {q ? `Resultados para “${q}”` : "Últimos posts"}
        </h2>
        {items.length ? <PostGrid posts={items} /> : <Empty title={q ? "Nenhum post encontrado" : "Nenhum post publicado ainda"} description={q ? "Tente outras palavras." : "Volte em breve!"} />}
        <BlogPagination page={page} pageSize={12} total={latest.meta.total} basePath="/blog" params={{ q }} />
      </section>
    </div>
  );
}
