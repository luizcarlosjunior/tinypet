import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AddressInput, EmailInput, PhoneInput, UpdateProfileInput } from "@tinypet/shared";
import { api, qs } from "@/lib/api";
import type { Address, Appointment, Contract, Email, HomeData, Installment, Notification, Phone, PlanInfo } from "@/lib/types";

export function useHome() {
  return useQuery({ queryKey: ["me", "home"], queryFn: () => api<HomeData>("/me/home") });
}
export function usePlan() {
  return useQuery({ queryKey: ["me", "plan"], queryFn: () => api<PlanInfo>("/me/plan") });
}
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput & { username?: string }) => api("/auth/me", { method: "PATCH", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

type Kind = "phones" | "emails" | "addresses";
export function useMyContacts<T extends Phone | Email | Address>(kind: Kind) {
  return useQuery({ queryKey: ["me", kind], queryFn: () => api<T[]>(`/me/${kind}`) });
}
export function useContactMutations(kind: Kind) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["me", kind] });
  const create = useMutation({ mutationFn: (input: PhoneInput | EmailInput | AddressInput) => api(`/me/${kind}`, { method: "POST", json: input }), onSuccess: inv });
  const update = useMutation({ mutationFn: ({ id, ...input }: { id: string } & Partial<PhoneInput | EmailInput | AddressInput>) => api(`/me/${kind}/${id}`, { method: "PATCH", json: input }), onSuccess: inv });
  const remove = useMutation({ mutationFn: (id: string) => api(`/me/${kind}/${id}`, { method: "DELETE" }), onSuccess: inv });
  return { create, update, remove };
}

export function useMyAppointments(range?: { from?: string; to?: string }) {
  return useQuery({ queryKey: ["me", "appointments", range], queryFn: () => api<Appointment[]>(`/me/appointments${qs({ from: range?.from, to: range?.to })}`) });
}
export function useMyAppointment(id: string | undefined) {
  return useQuery({
    queryKey: ["me", "appointments", "one", id],
    queryFn: async () => {
      // There is no GET /me/appointments/:id and the list defaults to today → +60 days: ask for a wide window
      // so past visits (history, "Avaliar serviço") and far-future ones open too.
      const day = 86_400_000;
      const list = await api<Appointment[]>(`/me/appointments${qs({ from: new Date(Date.now() - 400 * day).toISOString(), to: new Date(Date.now() + 400 * day).toISOString() })}`);
      return list.find((a) => a.id === id) ?? null;
    },
    enabled: !!id,
  });
}
export function useAppointmentActions() {
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["me", "appointments"] });
    qc.invalidateQueries({ queryKey: ["me", "home"] });
  };
  const cancel = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => api(`/me/appointments/${id}/cancel`, { method: "POST", json: { reason } }), onSuccess: inv });
  const reschedule = useMutation({ mutationFn: ({ id, startsAt }: { id: string; startsAt: string }) => api(`/me/appointments/${id}/reschedule`, { method: "POST", json: { startsAt } }), onSuccess: inv });
  return { cancel, reschedule };
}

export function useMyContracts() {
  return useQuery({ queryKey: ["me", "contracts"], queryFn: () => api<Contract[]>("/me/contracts") });
}
export function useMyContract(id: string | undefined) {
  return useQuery({ queryKey: ["me", "contracts", id], queryFn: () => api<Contract>(`/me/contracts/${id}`), enabled: !!id });
}
export function useAcceptContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/me/contracts/${id}/accept`, { method: "POST", json: { accept: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "contracts"] }),
  });
}
export function useMyInstallments(status?: string) {
  return useQuery({ queryKey: ["me", "installments", status], queryFn: () => api<Installment[]>(`/me/installments${qs({ status })}`) });
}

export function useNotifications() {
  return useQuery({ queryKey: ["notifications"], queryFn: () => api<Notification[]>("/notifications") });
}
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api("/notifications", { method: "PATCH" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: () => api("/auth/me", { method: "DELETE" }) });
}
