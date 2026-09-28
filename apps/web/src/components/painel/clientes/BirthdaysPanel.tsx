"use client";
import { useState } from "react";
import Link from "next/link";
import { Cake, MessageCircle } from "lucide-react";
import { Card, Spinner } from "@/components/ui";
import { useBirthdays } from "@/hooks/use-crm";
import { MONTHS, whatsappLink } from "@/lib/format";

function dayOf(d: string | null | undefined) {
  return d ? parseInt(d.slice(8, 10), 10) : 0;
}

export function BirthdaysPanel({ partnerId }: { partnerId: string | null }) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const q = useBirthdays(month, partnerId);
  const clients = [...(q.data?.clients ?? [])].sort((a, b) => dayOf(a.birthDate) - dayOf(b.birthDate));
  const pets = [...(q.data?.pets ?? [])].sort((a, b) => dayOf(a.birthDate) - dayOf(b.birthDate));
  return (
    <Card
      title="Aniversariantes do mês"
      actions={
        <select aria-label="Mês" className="input h-8 w-auto py-0 text-xs" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      }
    >
      {q.isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : q.error ? (
        <p className="text-sm text-[var(--muted)]">Não foi possível carregar.</p>
      ) : clients.length + pets.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Ninguém faz aniversário em {MONTHS[month - 1]}.</p>
      ) : (
        <ul className="divide-y text-sm">
          {pets.map((p) => {
            const owner = p.client ?? p.clients?.[0]?.client ?? null;
            return (
              <li key={`p-${p.id}`} className="flex items-center gap-2 py-2">
                <Cake className="h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <strong>{p.name}</strong> <span className="text-[var(--muted)]">(pet{owner ? ` de ${owner.name}` : ""})</span>
                  </span>
                  <span className="text-xs text-[var(--muted)]">dia {dayOf(p.birthDate)}</span>
                </span>
                {owner?.primaryPhone && (
                  <a href={whatsappLink(owner.primaryPhone, `Feliz aniversário para ${p.name}! 🎉`)} target="_blank" rel="noreferrer" className="btn-ghost h-8 w-8 p-0 text-emerald-600" aria-label={`Enviar WhatsApp para ${owner.name}`}>
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
              </li>
            );
          })}
          {clients.map((c) => (
            <li key={`c-${c.id}`} className="flex items-center gap-2 py-2">
              <Cake className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <Link href={`/painel/clientes/${c.id}`} className="block truncate font-medium hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-[var(--muted)]">dia {dayOf(c.birthDate)}</span>
              </span>
              {c.primaryPhone && (
                <a href={whatsappLink(c.primaryPhone, `Feliz aniversário, ${c.name}! 🎉`)} target="_blank" rel="noreferrer" className="btn-ghost h-8 w-8 p-0 text-emerald-600" aria-label={`Enviar WhatsApp para ${c.name}`}>
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
