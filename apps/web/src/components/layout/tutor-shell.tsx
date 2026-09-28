"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, Home, PawPrint, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./public-header";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu } from "./user-menu";
import { useOwnerTerm } from "@/hooks/use-owner-term";
import { TermsGate } from "./terms-gate";

const TABS = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/pets", label: "Meus pets", icon: PawPrint },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/contratos", label: "Contratos", icon: FileText },
  { href: "/conta", label: "Conta", icon: UserCircle },
];

export function TutorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const term = useOwnerTerm();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-[var(--bg)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo />
          <span className="hidden text-sm text-[var(--muted)] sm:inline">Área do {term}</span>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/buscar" className="btn-ghost hidden sm:inline-flex">
              Buscar parceiros
            </Link>
            <ThemeToggle />
            <NotificationsBell />
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block" aria-label="Navegação do tutor">
          <nav className="sticky top-24 space-y-1">
            {TABS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition", isActive(href) ? "bg-brand-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-24 md:pb-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-[var(--card)] md:hidden" aria-label="Navegação do tutor">
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} aria-current={isActive(href) ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive(href) ? "text-brand-600 dark:text-brand-400" : "text-[var(--muted)]")}>
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <TermsGate />
    </div>
  );
}
