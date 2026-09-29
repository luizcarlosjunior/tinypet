import Link from "next/link";
import { cn } from "@/lib/utils";

export function CategoryChips({ categories, activeSlug }: { categories: { name: string; slug: string; postCount?: number }[]; activeSlug?: string | null }) {
  if (!categories.length) return null;
  const chip = (active: boolean) =>
    cn("inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm transition", active ? "border-brand-500 bg-brand-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800");
  return (
    <nav aria-label="Categorias do blog" className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul className="flex gap-2">
        <li>
          <Link href="/blog" className={chip(!activeSlug)} aria-current={!activeSlug ? "page" : undefined}>
            Todos
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={`/blog/categoria/${c.slug}`} className={chip(activeSlug === c.slug)} aria-current={activeSlug === c.slug ? "page" : undefined}>
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Prev / next pagination with page numbers (links keep the other query params). */
export function BlogPagination({ page, pageSize, total, basePath, params = {} }: { page: number; pageSize: number; total: number; basePath: string; params?: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))).sort((a, b) => a - b);
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-center gap-1 pt-4">
      {page > 1 && (
        <Link href={href(page - 1)} className="btn-ghost" rel="prev">
          ← Anteriores
        </Link>
      )}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && nums[i - 1]! < n - 1 && <span className="px-1 text-[var(--muted)]">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={cn("btn-ghost min-w-[2.5rem]", n === page && "bg-ink-100 font-semibold dark:bg-ink-800")}>
            {n}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} className="btn-ghost" rel="next">
          Próximos →
        </Link>
      )}
    </nav>
  );
}
