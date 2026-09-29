import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { appUrl } from "@/lib/server-api";
import { Empty } from "@/components/ui";
import { PostGrid } from "@/components/blog/post-card";
import { BlogPagination, CategoryChips } from "@/components/blog/blog-nav";
import { categoryTree } from "@/server/blog/categories";
import { listPublicPosts } from "@/server/blog/posts";

export const revalidate = 60;

async function load(slug: string, page: number) {
  const [list, tree] = await Promise.all([listPublicPosts({ category: slug, page, pageSize: 12 }), categoryTree({ publicOnly: true })]);
  return { list, tree };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { list } = await load(params.slug, 1);
  const c = list.category;
  if (!c) return { title: "Categoria não encontrada" };
  const description = c.description?.slice(0, 180) || `Posts sobre ${c.name} no blog tinyPet.`;
  return { title: `${c.name} · Blog`, description, alternates: { canonical: appUrl(`/blog/categoria/${c.slug}`) }, openGraph: { title: `${c.name} · Blog tinyPet`, description, url: appUrl(`/blog/categoria/${c.slug}`) } };
}

export default async function CategoryPage({ params, searchParams }: { params: { slug: string }; searchParams: { page?: string } }) {
  const page = Math.min(1000, Math.max(1, Number(searchParams.page) || 1));
  const { list, tree } = await load(params.slug, page);
  const c = list.category;
  if (!c) notFound();
  const root = tree.find((r) => r.id === c.id || r.children.some((x) => x.id === c.id));
  const chips = tree.filter((r) => r.postCount > 0 || r.children.some((x) => x.postCount > 0));
  const subs = root?.children.filter((x) => x.postCount > 0) ?? [];

  return (
    <div className="space-y-6">
      <nav aria-label="Trilha" className="text-sm text-[var(--muted)]">
        <Link href="/blog" className="hover:underline">
          Blog
        </Link>
        {root && root.id !== c.id && (
          <>
            {" / "}
            <Link href={`/blog/categoria/${root.slug}`} className="hover:underline">
              {root.name}
            </Link>
          </>
        )}
        {" / "}
        <span aria-current="page">{c.name}</span>
      </nav>
      <header className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{c.name}</h1>
        {c.description && <p className="max-w-3xl text-[var(--muted)]">{c.description}</p>}
        <CategoryChips categories={chips} activeSlug={root?.slug ?? c.slug} />
        {subs.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Subcategorias">
            {subs.map((s) => (
              <li key={s.id}>
                <Link href={`/blog/categoria/${s.slug}`} aria-current={s.id === c.id ? "page" : undefined} className={`inline-flex rounded-full px-3 py-1 text-xs ${s.id === c.id ? "bg-brand-100 font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200" : "bg-ink-100 dark:bg-ink-800"}`}>
                  {s.name} ({s.postCount})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>
      {list.items.length ? <PostGrid posts={list.items} headingLevel={2} /> : <Empty title="Nenhum post nesta categoria ainda" />}
      <BlogPagination page={page} pageSize={12} total={list.meta.total} basePath={`/blog/categoria/${c.slug}`} />
    </div>
  );
}
