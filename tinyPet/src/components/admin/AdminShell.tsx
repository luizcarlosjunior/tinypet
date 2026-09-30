"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Award, BarChart3, BookA, Boxes, Cog, Crown, Dog, Flag, FolderTree, Image as ImageIcon, LayoutGrid, LogOut, Menu, MessageSquare, Newspaper, PawPrint, Puzzle, Store, Tag, Users, X, Baby, ListTree, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/layout/ThemeToggle";

export const ADMIN_NAV = [
  { href: "/admin/categorias", label: "Categorias", icon: FolderTree },
  { href: "/admin/termos", label: "Termos do tutor", icon: BookA },
  { href: "/admin/especies", label: "Espécies e raças", icon: Dog },
  { href: "/admin/marcas", label: "Marcas e linhas", icon: Tag },
  { href: "/admin/comandos", label: "Comandos", icon: PawPrint },
  { href: "/admin/fases-da-vida", label: "Fases da vida", icon: Baby },
  { href: "/admin/badges", label: "Badges", icon: Award },
  { href: "/admin/planos", label: "Planos e limites", icon: Crown },
  { href: "/admin/add-ons", label: "Add-ons", icon: Puzzle },
  { href: "/admin/configuracoes", label: "Configurações", icon: Cog },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/parceiros", label: "Parceiros", icon: Store },
  { href: "/admin/moderacao", label: "Moderação", icon: Flag },
  { href: "/admin/auditoria", label: "Auditoria de mídia", icon: ShieldAlert },
];

/** Blog section — the only one visible to EDITOR accounts. */
export const BLOG_NAV = [
  { href: "/admin/blog", label: "Posts", icon: Newspaper, exact: true },
  { href: "/admin/blog/categorias", label: "Categorias do blog", icon: ListTree },
  { href: "/admin/blog/midia", label: "Mídia", icon: ImageIcon },
  { href: "/admin/blog/comentarios", label: "Comentários", icon: MessageSquare },
  { href: "/admin/blog/estatisticas", label: "Estatísticas", icon: BarChart3 },
];

export type AdminRole = "ADMIN" | "EDITOR";

const linkCls = (active: boolean) => cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition", active ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "text-[var(--muted)] hover:bg-ink-100 hover:text-[var(--fg)] dark:hover:bg-ink-800");

function isBlogActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href || pathname === `${href}/novo` || (/^\/admin\/blog\/[^/]+$/.test(pathname) && !BLOG_NAV.some((n) => n.href === pathname));
  return pathname.startsWith(href);
}

export function AdminShell({ children, userName, role = "ADMIN" }: { children: React.ReactNode; userName: string; role?: AdminRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const isEditor = role === "EDITOR";
  const outsideBlog = isEditor && !(pathname === "/admin/blog" || pathname.startsWith("/admin/blog/"));
  // Editors only manage the blog: bounce them from every other admin page.
  useEffect(() => {
    if (outsideBlog) router.replace("/admin/blog");
  }, [outsideBlog, router]);

  const nav = (
    <nav aria-label="Menu do admin" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
      {!isEditor && (
        <>
          <Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined} className={linkCls(pathname === "/admin")}>
            <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden /> Visão geral
          </Link>
          {ADMIN_NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={linkCls(active)}>
                <n.icon className="h-4 w-4 shrink-0" aria-hidden />
                {n.label}
              </Link>
            );
          })}
        </>
      )}
      <p className={cn("px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]", !isEditor && "mt-4")}>Blog</p>
      {BLOG_NAV.map((n) => {
        const active = isBlogActive(pathname, n.href, n.exact);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={linkCls(active)}>
            <n.icon className="h-4 w-4 shrink-0" aria-hidden />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-[var(--card)] lg:flex" aria-label="Barra lateral">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Link href={isEditor ? "/admin/blog" : "/admin"} className="flex items-center gap-2 font-bold">
            <Boxes className="h-5 w-5 text-brand-500" aria-hidden /> tinyPet
          </Link>
          <span className="badge bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900">{isEditor ? "Blog" : "Admin"}</span>
        </div>
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative flex w-72 max-w-[85vw] flex-col bg-[var(--card)] shadow-xl" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="font-bold">{isEditor ? "Blog tinyPet" : "Admin tinyPet"}</span>
              <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-[var(--card)] px-3 sm:px-4">
          <button type="button" className="btn-ghost h-9 w-9 p-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="badge bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900 lg:hidden">{isEditor ? "Blog" : "Admin"}</span>
          <span className="truncate text-sm text-[var(--muted)]">{userName}</span>
          <div className="ml-auto flex items-center gap-1">
            {!isEditor && (
              <Link href="/painel" className="btn-ghost hidden text-sm sm:inline-flex">
                Painel do parceiro
              </Link>
            )}
            <Link href="/inicio" className="btn-ghost hidden text-sm sm:inline-flex">
              Área do tutor
            </Link>
            <ThemeToggle />
            <button type="button" className="btn-ghost h-9 gap-1 text-sm" onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut className="h-4 w-4" aria-hidden /> Sair
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{outsideBlog ? null : children}</main>
      </div>
    </div>
  );
}
