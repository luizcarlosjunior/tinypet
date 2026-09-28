"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Building2, ChevronDown, LogOut, PawPrint, Shield, UserRound } from "lucide-react";
import { useSessionContext } from "@/hooks/use-session-context";
import { setActivePartnerId } from "@/lib/api-client";
import { Avatar } from "@/components/ui/avatar";

export function UserMenu() {
  const { user, memberships, isLoggedIn } = useSessionContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/entrar" className="btn-ghost">
          Entrar
        </Link>
        <Link href="/cadastro" className="btn-primary">
          Cadastrar
        </Link>
      </div>
    );
  }

  function switchTo(partnerId: string) {
    setActivePartnerId(partnerId);
    setOpen(false);
    router.push("/painel");
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-ink-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:bg-ink-800">
        <Avatar src={user?.avatarUrl} name={user?.name} size={32} />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">{user?.name ?? "Minha conta"}</span>
        <ChevronDown className="h-4 w-4 text-[var(--muted)]" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border bg-[var(--card)] py-1 shadow-lg">
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-[var(--muted)]">{user?.email}</p>
          </div>
          <MenuLink href="/inicio" icon={<UserRound className="h-4 w-4" aria-hidden />} onClick={() => setOpen(false)}>
            Área do {user?.ownerTerm || "Tutor"}
          </MenuLink>
          <MenuLink href="/pets" icon={<PawPrint className="h-4 w-4" aria-hidden />} onClick={() => setOpen(false)}>
            Meus pets
          </MenuLink>
          {memberships.length > 0 && (
            <div className="border-t py-1">
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Meus negócios</p>
              {memberships.map((m) => (
                <button key={m.partnerId} type="button" role="menuitem" onClick={() => switchTo(m.partnerId)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-ink-100 dark:hover:bg-ink-800">
                  <Avatar src={m.logoUrl} name={m.partnerName} size={24} square />
                  <span className="truncate">{m.partnerName}</span>
                  {!m.published && <span className="ml-auto text-[10px] text-[var(--muted)]">rascunho</span>}
                </button>
              ))}
            </div>
          )}
          <div className="border-t py-1">
            <MenuLink href="/painel/novo" icon={<Building2 className="h-4 w-4" aria-hidden />} onClick={() => setOpen(false)}>
              {memberships.length ? "Criar outro negócio" : "Sou parceiro"}
            </MenuLink>
            {user?.role === "ADMIN" && (
              <MenuLink href="/admin" icon={<Shield className="h-4 w-4" aria-hidden />} onClick={() => setOpen(false)}>
                Admin
              </MenuLink>
            )}
            <button type="button" role="menuitem" onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-ink-100 dark:text-red-400 dark:hover:bg-ink-800">
              <LogOut className="h-4 w-4" aria-hidden /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link href={href} role="menuitem" onClick={onClick} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-ink-100 dark:hover:bg-ink-800">
      {icon}
      {children}
    </Link>
  );
}
