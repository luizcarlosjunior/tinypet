"use client";
import Link from "next/link";
import { ADMIN_NAV } from "@/components/admin/AdminShell";

export default function AdminHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Administração</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Tabelas de referência, planos, usuários, parceiros e moderação da plataforma.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_NAV.map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="card flex items-center gap-3 transition hover:border-brand-300">
              <n.icon className="h-5 w-5 text-brand-500" aria-hidden />
              <span className="font-medium">{n.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
