"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiList } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import type { Contract, FinanceSummary, Installment, Transaction } from "@/types/api";

export type QueryParams = Record<string, string | number | boolean | null | undefined>;
export function qs(params: QueryParams = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const financeKey = (partnerId: string | null, ...rest: unknown[]) => ["finance", partnerId, ...rest];

export function useFinanceSummary(partnerId: string | null, params: { from?: string; to?: string } = {}) {
  return useQuery({ queryKey: financeKey(partnerId, "summary", params), queryFn: () => api<FinanceSummary>(`/finance/summary${qs(params)}`), enabled: !!partnerId });
}
export function useContracts(partnerId: string | null, params: QueryParams = {}) {
  return useQuery({ queryKey: financeKey(partnerId, "contracts", params), queryFn: () => apiList<Contract[]>(`/finance/contracts${qs(params)}`), enabled: !!partnerId });
}
export function useContract(partnerId: string | null, id: string | null) {
  return useQuery({ queryKey: financeKey(partnerId, "contract", id), queryFn: () => api<Contract>(`/finance/contracts/${id}`), enabled: !!partnerId && !!id });
}
export function useInstallments(partnerId: string | null, params: QueryParams = {}) {
  return useQuery({ queryKey: financeKey(partnerId, "installments", params), queryFn: () => apiList<Installment[]>(`/finance/installments${qs(params)}`), enabled: !!partnerId });
}
export function useTransactions(partnerId: string | null, params: QueryParams = {}) {
  return useQuery({ queryKey: financeKey(partnerId, "transactions", params), queryFn: () => apiList<Transaction[]>(`/finance/transactions${qs(params)}`), enabled: !!partnerId });
}

/** Generic finance mutation: invalidates every ["finance", ...] query and toasts. */
function useFinanceMutation<TVars, TData = unknown>(fn: (vars: TVars) => Promise<TData>, opts: { success?: string; silent?: boolean; onSuccess?: (data: TData, vars: TVars) => void } = {}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (opts.success) toast(opts.success, "success");
      opts.onSuccess?.(data, vars);
    },
    onError: (e) => {
      if (!opts.silent) toast(errorMessage(e), "error");
    },
  });
}

export function useRemindInstallment() {
  return useFinanceMutation((id: string) => api(`/finance/installments/${id}/remind`, { method: "POST" }), { success: "Lembrete enviado ao tutor" });
}
export function useRegisterPayment(onDone?: () => void) {
  return useFinanceMutation(({ id, body }: { id: string; body: unknown }) => api<Installment>(`/finance/installments/${id}/payments`, { method: "POST", json: body }), { success: "Pagamento registrado", onSuccess: () => onDone?.() });
}
export function useDeletePayment() {
  return useFinanceMutation((pid: string) => api(`/finance/payments/${pid}`, { method: "DELETE" }), { success: "Pagamento estornado" });
}
export function useCreateTransaction(onDone?: () => void) {
  return useFinanceMutation((body: unknown) => api<Transaction>(`/finance/transactions`, { method: "POST", json: body }), { success: "Lançamento salvo", onSuccess: () => onDone?.() });
}
export function useDeleteTransaction() {
  return useFinanceMutation((id: string) => api(`/finance/transactions/${id}`, { method: "DELETE" }), { success: "Lançamento removido" });
}
export function useCreateContract(onDone?: (c: Contract) => void) {
  return useFinanceMutation((body: unknown) => api<Contract>(`/finance/contracts`, { method: "POST", json: body }), { success: "Contrato criado", silent: true, onSuccess: (c) => onDone?.(c) });
}
export function useUpdateContract(id: string) {
  return useFinanceMutation((body: unknown) => api<Contract>(`/finance/contracts/${id}`, { method: "PATCH", json: body }), { success: "Contrato atualizado" });
}
export function useContractStatus(id: string) {
  return useFinanceMutation((status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELED") => api<Contract>(`/finance/contracts/${id}/status`, { method: "POST", json: { status } }), { success: "Status atualizado" });
}
