"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PawPrint, Search } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { NotificationsBell } from "./notifications-bell";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-1.5 text-lg font-extrabold tracking-tight ${className}`} aria-label="tinyPet — página inicial">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white">
        <PawPrint className="h-5 w-5" aria-hidden />
      </span>
      <span>
        tiny<span className="text-brand-500">Pet</span>
      </span>
    </Link>
  );
}

export function PublicHeader({ showSearch = true }: { showSearch?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-30 border-b bg-[var(--bg)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Logo />
        {showSearch && (
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/buscar${q ? `?q=${encodeURIComponent(q)}` : ""}`);
            }}
            className="mx-auto hidden w-full max-w-md md:block"
          >
            <label htmlFor="header-search" className="sr-only">
              Buscar parceiros
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
              <input id="header-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar clínicas, adestradores, pet shops…" className="input h-10 pl-9" />
            </div>
          </form>
        )}
        <nav className="ml-auto flex items-center gap-1" aria-label="Principal">
          <Link href="/buscar" className="btn-ghost hidden sm:inline-flex">
            Buscar parceiros
          </Link>
          <Link href="/cursos" className="btn-ghost hidden lg:inline-flex">
            Cursos
          </Link>
          <ThemeToggle />
          <NotificationsBell />
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
