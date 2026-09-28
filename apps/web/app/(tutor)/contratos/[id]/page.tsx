"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Printer } from "lucide-react";
import { useAcceptContract, useMyContract, type Installment } from "@/hooks/use-me";
import { Badge, Button, Empty, Spinner } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { formatBRL, INSTALLMENT_STATUS_LABEL } from "@tinypet/shared";
import { CONTRACT_STATUS_LABEL, CONTRACT_TYPE_LABEL } from "@/components/tutor/contract-labels";

const PERIOD = { WEEKLY: "semanal", BIWEEKLY: "quinzenal", MONTHLY: "mensal" } as const;
const INST_TONE: Record<Installment["status"], "gray" | "green" | "red" | "amber"> = { PENDING: "amber", OVERDUE: "red", PAID: "green", CANCELED: "gray" };

export default function ContratoPage({ params }: { params: { id: string } }) {
  const q = useMyContract(params.id);
  const accept = useAcceptContract();
  const { toast } = useToast();
  const [agree, setAgree] = useState(false);
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <Empty title="Contrato não encontrado" description={errorMessage(q.error)} action={<Link href="/contratos" className="btn-secondary">Voltar</Link>} />;
  const c = q.data;
  const total = Number(c.totalAmount) - Number(c.discount || 0);
  const pdfHref = c.pdfUrl ?? null;

  return (
    <div className="space-y-6 print:space-y-4">
      <Link href="/contratos" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline print:hidden">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Contratos
      </Link>
      <header className="flex flex-wrap items-start gap-4">
        {c.partner && <Avatar src={c.partner.logoUrl} name={c.partner.tradeName} size={56} square />}
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            {CONTRACT_TYPE_LABEL[c.type]} · {c.partner?.tradeName}
          </p>
          <h1 className="text-2xl font-bold">{c.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <Badge tone={c.status === "ACTIVE" ? "green" : c.status === "DRAFT" ? "amber" : c.status === "CANCELED" ? "red" : "gray"}>{CONTRACT_STATUS_LABEL[c.status]}</Badge>
            {c.acceptedAt && (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Aceito em {fmtDateTime(c.acceptedAt)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          {pdfHref ? (
            <a href={pdfHref} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <Printer className="h-4 w-4" aria-hidden /> PDF
            </a>
          ) : (
            <Button type="button" variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden /> Imprimir
            </Button>
          )}
        </div>
      </header>

      {c.description && <p className="whitespace-pre-line text-sm">{c.description}</p>}

      <section className="card" aria-labelledby="itens">
        <h2 id="itens" className="mb-2 font-semibold">
          Itens
        </h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="py-1">Descrição</th>
              <th className="py-1 text-right">Qtd.</th>
              <th className="py-1 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(c.items ?? []).map((it) => (
              <tr key={it.id}>
                <td className="py-1.5">{it.description}</td>
                <td className="py-1.5 text-right">{it.quantity}</td>
                <td className="py-1.5 text-right">{formatBRL(Number(it.unitPrice) * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            {Number(c.discount) > 0 && (
              <tr>
                <td colSpan={2} className="pt-2 text-right text-[var(--muted)]">
                  Desconto
                </td>
                <td className="pt-2 text-right">-{formatBRL(c.discount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={2} className="pt-1 text-right font-semibold">
                Total
              </td>
              <td className="pt-1 text-right font-semibold">{formatBRL(total)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {c.installmentsCount}x {PERIOD[c.periodicity]} · primeira em {fmtDate(c.firstDueDate)}
          {c.sessionsCount ? ` · ${c.sessionsCount} sessões` : ""}
          {c.pets?.length ? ` · Pets: ${c.pets.map((p) => p.pet?.name).filter(Boolean).join(", ")}` : ""}
        </p>
      </section>

      {(c.installments ?? []).length > 0 && (
        <section className="card" aria-labelledby="parcelas">
          <h2 id="parcelas" className="mb-2 font-semibold">
            Parcelas
          </h2>
          <ul className="divide-y text-sm">
            {(c.installments ?? []).map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2">
                <span className="w-8 text-[var(--muted)]">{i.number}ª</span>
                <span className="flex-1">Vence em {fmtDate(i.dueDate)}</span>
                <span className="font-medium">{formatBRL(i.amount)}</span>
                {Number(i.paidAmount) > 0 && i.status !== "PAID" && <span className="text-xs text-[var(--muted)]">pago {formatBRL(i.paidAmount)}</span>}
                <Badge tone={INST_TONE[i.status]}>{INSTALLMENT_STATUS_LABEL[i.status]}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.terms && (
        <section className="card" aria-labelledby="termos">
          <h2 id="termos" className="mb-2 font-semibold">
            Termos do contrato
          </h2>
          <p className="whitespace-pre-line text-sm">{c.terms}</p>
        </section>
      )}

      {!c.acceptedAt && c.status !== "CANCELED" && (
        <section className="card border-brand-300 print:hidden" aria-labelledby="aceite">
          <h2 id="aceite" className="font-semibold">
            Aceite do contrato
          </h2>
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-500" />
            <span>Li e concordo com os itens, valores, parcelas e termos acima. Meu aceite será registrado com data, hora e endereço IP.</span>
          </label>
          <Button type="button" className="mt-3" disabled={!agree} loading={accept.isPending} onClick={() => accept.mutateAsync(c.id).then(() => toast("Contrato aceito!", "success")).catch((e) => toast(errorMessage(e), "error"))}>
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Aceitar contrato
          </Button>
        </section>
      )}
    </div>
  );
}
