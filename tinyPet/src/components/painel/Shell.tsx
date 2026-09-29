"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useContext, useEffect, useRef, useState } from "react";
import { Bell, Calendar, Crown, ExternalLink, GraduationCap, LayoutDashboard, LogOut, Menu, Package, PawPrint, Store, UserCog, Users, Wallet, BarChart3, X, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useSessionContext } from "@/hooks/use-session-context";
import { PartnerContext, usePartnerState } from "@/hooks/use-partner";
import { useMarkAllRead, useNotifications } from "@/hooks/use-notifications";
import { fmtRelativeDays } from "@/lib/format";
import { Avatar } from "./ui";
import { TermsGate } from "@/components/layout/terms-gate";

const NAV = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, exact: true },
  { href: "/painel/agenda", label: "Agenda", icon: Calendar },
  { href: "/painel/clientes", label: "Clientes", icon: Users },
  { href: "/painel/catalogo", label: "Catálogo", icon: Package },
  { href: "/painel/financeiro", label: "Financeiro", icon: Wallet, finance: true },
  { href: "/painel/cursos", label: "Cursos", icon: GraduationCap },
  { href: "/painel/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/painel/perfil", label: "Perfil e página pública", icon: Store },
  { href: "/painel/equipe", label: "Equipe", icon: UserCog },
  { href: "/painel/plano", label: "Plano", icon: Crown },
];

export function PanelShell({ children }: { children: React.ReactNode }) {
  const session = useSessionContext();
  const state = usePartnerState();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isNew = pathname === "/painel/novo";

  useEffect(() => {
    if (session.data && state.memberships.length === 0 && !isNew) router.replace("/painel/novo");
  }, [session.data, state.memberships.length, isNew, router]);

  useEffect(() => setOpen(false), [pathname]);

  if (session.isLoading || (!session.data && !session.error)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (session.error && !session.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium">Não foi possível carregar sua sessão.</p>
        <Link href="/entrar?next=/painel" className="btn-primary">
          Entrar novamente
        </Link>
      </div>
    );
  }

  const canSeeFinance = state.membership?.role === "OWNER" || !!state.membership?.canSeeFinance;
  const nav = NAV.filter((n) => !n.finance || canSeeFinance);

  if (isNew && state.memberships.length === 0) {
    return (
      <PartnerContext.Provider value={state}>
        <div className="min-h-screen">
          <header className="flex h-14 items-center justify-between border-b bg-[var(--card)] px-4">
            <Link href="/" className="flex items-center gap-2 font-bold">
              <PawPrint className="h-5 w-5 text-brand-500" /> tinyPet
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/inicio" className="btn-ghost text-sm">
                Área do tutor
              </Link>
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto max-w-3xl p-4 sm:p-6">{children}</main>
        </div>
      </PartnerContext.Provider>
    );
  }

  const sidebar = (
    <nav aria-label="Menu do painel" className="flex flex-1 flex-col gap-0.5 p-3">
      {nav.map((n) => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition", active ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "text-[var(--muted)] hover:bg-ink-100 hover:text-[var(--fg)] dark:hover:bg-ink-800")}>
            <n.icon className="h-4 w-4 shrink-0" aria-hidden />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <PartnerContext.Provider value={state}>
      <TermsGate />
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-[var(--card)] lg:flex" aria-label="Barra lateral">
          <div className="flex h-14 items-center gap-2 border-b px-4">
            <Link href="/painel" className="flex items-center gap-2 font-bold">
              <PawPrint className="h-5 w-5 text-brand-500" aria-hidden /> tinyPet
            </Link>
            <span className="badge bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">Parceiro</span>
          </div>
          {sidebar}
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="relative flex w-72 max-w-[85vw] flex-col bg-[var(--card)] shadow-xl" role="dialog" aria-modal="true" aria-label="Menu">
              <div className="flex h-14 items-center justify-between border-b px-4">
                <span className="flex items-center gap-2 font-bold">
                  <PawPrint className="h-5 w-5 text-brand-500" aria-hidden /> tinyPet
                </span>
                <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setOpen(false)} aria-label="Fechar menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebar}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-[var(--card)] px-3 sm:px-4">
            <button type="button" className="btn-ghost h-9 w-9 p-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
            <PartnerSwitcher />
            <div className="ml-auto flex items-center gap-1">
              {state.membership?.slug && (
                <Link href={`/p/${state.membership.slug}`} target="_blank" className="btn-ghost hidden text-sm sm:inline-flex" title="Ver página pública">
                  <ExternalLink className="h-4 w-4" aria-hidden /> Ver página pública
                </Link>
              )}
              <Link href="/inicio" className="btn-ghost hidden text-sm md:inline-flex">
                Área do tutor
              </Link>
              <NotificationsBell />
              <ThemeToggle />
              <UserMenu name={session.data?.user.name ?? ""} avatarUrl={session.data?.user.avatarUrl} />
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{state.ready ? children : <Spinner />}</main>
        </div>
      </div>
    </PartnerContext.Provider>
  );
}

function PartnerSwitcher() {
  const state = useContextState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  if (!state.membership) return null;
  return (
    <div ref={ref} className="relative min-w-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className="flex max-w-[60vw] items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium hover:bg-ink-100 dark:hover:bg-ink-800 sm:max-w-xs">
        <Avatar src={state.membership.logoUrl} name={state.membership.partnerName} size={28} />
        <span className="truncate">{state.membership.partnerName}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
      </button>
      {open && (
        <ul role="listbox" aria-label="Trocar de parceiro" className="absolute left-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-xl border bg-[var(--card)] py-1 shadow-lg">
          {state.memberships.map((m) => (
            <li key={m.partnerId} role="option" aria-selected={m.partnerId === state.partnerId}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink-100 dark:hover:bg-ink-800"
                onClick={() => {
                  state.setPartnerId(m.partnerId);
                  setOpen(false);
                }}
              >
                <Avatar src={m.logoUrl} name={m.partnerName} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{m.partnerName}</span>
                  <span className="block text-xs text-[var(--muted)]">{m.role === "OWNER" ? "Dono" : "Equipe"}</span>
                </span>
                {m.partnerId === state.partnerId && <Check className="h-4 w-4 text-brand-500" aria-hidden />}
              </button>
            </li>
          ))}
          <li className="border-t">
            <Link href="/painel/novo" className="block px-3 py-2 text-sm text-brand-600 hover:bg-ink-100 dark:text-brand-300 dark:hover:bg-ink-800">
              + Criar novo parceiro
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

function useContextState() {
  const ctx = useContext(PartnerContext);
  if (!ctx) throw new Error("PartnerContext ausente");
  return ctx;
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const q = useNotifications();
  const markAll = useMarkAllRead();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const items = q.data ?? [];
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn-ghost relative h-9 w-9 p-0" onClick={() => setOpen((o) => !o)} aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-80 max-w-[90vw] overflow-hidden rounded-xl border bg-[var(--card)] shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Notificações</span>
            {unread > 0 && (
              <button type="button" className="text-xs text-brand-600 hover:underline dark:text-brand-300" onClick={() => markAll.mutate()}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {q.isLoading && (
              <li className="p-4">
                <Spinner />
              </li>
            )}
            {!q.isLoading && items.length === 0 && <li className="p-4 text-sm text-[var(--muted)]">Nenhuma notificação por aqui.</li>}
            {items.map((n) => (
              <li key={n.id} className={cn("border-b px-3 py-2 text-sm last:border-0", !n.readAt && "bg-brand-50/60 dark:bg-brand-900/10")}>
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-[var(--muted)]">{n.body}</p>}
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{fmtRelativeDays(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn-ghost h-9 gap-2 px-1.5" onClick={() => setOpen((o) => !o)} aria-label="Menu do usuário" aria-expanded={open}>
        <Avatar src={avatarUrl} name={name || "?"} size={28} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-xl border bg-[var(--card)] py-1 shadow-lg">
          <p className="truncate px-3 py-2 text-sm font-medium">{name}</p>
          <Link href="/inicio" className="block px-3 py-2 text-sm hover:bg-ink-100 dark:hover:bg-ink-800">
            Área do tutor
          </Link>
          <Link href="/conta" className="block px-3 py-2 text-sm hover:bg-ink-100 dark:hover:bg-ink-800">
            Minha conta
          </Link>
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-ink-100 dark:text-red-300 dark:hover:bg-ink-800" onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </button>
        </div>
      )}
    </div>
  );
}
