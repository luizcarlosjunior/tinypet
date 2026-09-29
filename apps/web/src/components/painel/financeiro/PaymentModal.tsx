"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { paymentSchema, PAYMENT_METHOD_LABEL, formatBRL, safeHref } from "@tinypet/shared";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";
import { UploadButton } from "@/components/media/UploadButton";
import { useRegisterPayment } from "@/hooks/use-finance";
import { num, todayISO, fmtDay } from "@/lib/format";
import type { Installment } from "@/types/api";

type PaymentInput = z.infer<typeof paymentSchema>;

/** "Baixar parcela" modal: registers a (possibly partial) payment with optional receipt. */
export function PaymentModal({ installment, onClose, partnerId }: { installment: Installment | null; onClose: () => void; partnerId: string | null }) {
  const open = !!installment;
  const remaining = installment ? Math.max(0, Math.round((num(installment.amount) - num(installment.paidAmount)) * 100) / 100) : 0;
  const form = useForm<PaymentInput>({ resolver: zodResolver(paymentSchema), defaultValues: { paidAt: todayISO(), amount: remaining, method: "PIX", receiptUrl: null, notes: "" } });
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = form;
  const receiptUrl = watch("receiptUrl");
  const amount = watch("amount");
  useEffect(() => {
    if (installment) reset({ paidAt: todayISO(), amount: remaining, method: "PIX", receiptUrl: null, notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installment?.id]);
  const mut = useRegisterPayment(onClose);
  if (!installment) return null;
  const partial = num(amount) > 0 && num(amount) < remaining;
  return (
    <Modal open={open} onClose={onClose} title={`Baixar parcela ${installment.number}${installment.contract?.installmentsCount ? `/${installment.contract.installmentsCount}` : ""}`}>
      <p className="mb-4 text-sm text-[var(--muted)]">
        {installment.contract?.title && <span className="block font-medium text-[var(--fg)]">{installment.contract.title}</span>}
        Vencimento {fmtDay(installment.dueDate)} · valor {formatBRL(installment.amount)}
        {num(installment.paidAmount) > 0 && <> · já pago {formatBRL(installment.paidAmount)}</>}
      </p>
      <form className="space-y-3" onSubmit={handleSubmit((v) => mut.mutate({ id: installment.id, body: { ...v, receiptUrl: v.receiptUrl || null, notes: v.notes || null } }))} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Input id="pay-date" label="Data do pagamento" type="date" {...register("paidAt")} error={errors.paidAt?.message} />
          <Input id="pay-amount" label="Valor pago (R$)" type="number" step="0.01" min="0.01" inputMode="decimal" {...register("amount")} error={errors.amount?.message} />
        </div>
        {partial && <p className="text-xs text-amber-700 dark:text-amber-300">Pagamento parcial: restarão {formatBRL(remaining - num(amount))} nesta parcela.</p>}
        <Select id="pay-method" label="Forma de pagamento" {...register("method")} error={errors.method?.message}>
          {Object.entries(PAYMENT_METHOD_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <div>
          <span className="label">Comprovante (opcional)</span>
          <div className="flex flex-wrap items-center gap-2">
            <UploadButton purpose="RECEIPT" partnerId={partnerId} accept="image/*,application/pdf" label={receiptUrl ? "Trocar comprovante" : "Enviar comprovante"} onUploaded={(m) => setValue("receiptUrl", m.url)} />
            {receiptUrl && (
              <>
                <a href={safeHref(receiptUrl)} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 underline dark:text-brand-300">
                  Ver arquivo
                </a>
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setValue("receiptUrl", null)}>
                  Remover
                </button>
              </>
            )}
          </div>
        </div>
        <Textarea id="pay-notes" label="Observações" className="min-h-[60px]" {...register("notes")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Registrar pagamento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
