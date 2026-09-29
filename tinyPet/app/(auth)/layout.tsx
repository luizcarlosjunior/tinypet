import Link from "next/link";
import { Logo } from "@/components/layout/public-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-4">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">{children}</main>
      <footer className="px-4 py-6 text-center text-xs text-[var(--muted)]">
        <Link href="/termos" className="hover:underline">
          Termos
        </Link>{" "}
        ·{" "}
        <Link href="/privacidade" className="hover:underline">
          Privacidade
        </Link>
      </footer>
    </div>
  );
}
