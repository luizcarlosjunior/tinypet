"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { sessionContextKey } from "./use-session-context";
import type { Appointment } from "./use-appointments";

export type HomeData = {
  tasksToday: { id: string; petId: string; petName?: string; pet?: { id: string; name: string; avatarUrl?: string | null } | null; title: string; time?: string | null; times?: string[]; done?: boolean; completed?: boolean; completedAt?: string | null; skipped?: boolean; skipNote?: string | null }[];
  upcomingAppointments: Appointment[];
  recentBadges: { id: string; petId?: string; pet?: { id: string; name: string } | null; badge?: { key: string; name: string; description?: string | null; iconUrl?: string | null } | null; name?: string; earnedAt: string }[];
  pets: { id: string; name: string; avatarUrl: string | null; status?: string; role?: "owner" | "shared" }[];
  overdueInstallments: Installment[];
  /** pending pet share invites + ownership transfer requests addressed to me */
  pendingPetInvites?: number;
};

export type Installment = {
  id: string;
  contractId: string;
  number: number;
  dueDate: string;
  amount: string | number;
  paidAmount: string | number;
  status: "PENDING" | "OVERDUE" | "PAID" | "CANCELED";
  contract?: { id: string; title: string; partner?: { id: string; tradeName: string; slug: string } | null } | null;
};

export type Contract = {
  id: string;
  partnerId: string;
  partner?: { id: string; tradeName: string; slug: string; logoUrl?: string | null } | null;
  type: "PACKAGE" | "RECURRING" | "SINGLE" | "COURSE";
  title: string;
  description: string | null;
  totalAmount: string | number;
  discount: string | number;
  installmentsCount: number;
  firstDueDate: string;
  periodicity: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  sessionsCount: number | null;
  terms: string | null;
  acceptedAt: string | null;
  pdfUrl: string | null;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELED";
  createdAt: string;
  items?: { id: string; description: string; quantity: number; unitPrice: string | number }[];
  installments?: Installment[];
  /** API (decorateContract) flattens to `{ id, name }`; `pet` kept for older payloads */
  pets?: { id?: string; name?: string; pet?: { id: string; name: string } | null; petId?: string }[];
};

export type PlanInfo = { planKey: string; planName?: string; limits: Record<string, { enabled: boolean; quantity: number | null }>; usage: Record<string, number> };

export type Phone = { id: string; type: "MOBILE" | "LANDLINE" | "WHATSAPP"; number: string; isPrimary: boolean; verifiedAt: string | null };
export type EmailRow = { id: string; address: string; isPrimary: boolean; verifiedAt: string | null };
export type Address = { id: string; label: string | null; zipCode: string; street: string; number: string | null; complement: string | null; reference: string | null; accessNotes: string | null; district: string | null; city: string; state: string; latitude: string | number | null; longitude: string | number | null; isPrimary: boolean };
export type FamilyMember = { id: string; name: string; relationship: string | null; phone: string | null; email: string | null; canAuthorize: boolean; canPickUp: boolean; hasAccount?: boolean };

export const useHome = (enabled = true) => useQuery({ queryKey: ["me", "home"], queryFn: () => api<HomeData>("/me/home"), enabled });
export const useMyPlan = (enabled = true) => useQuery({ queryKey: ["me", "plan"], queryFn: () => api<PlanInfo>("/me/plan"), enabled });
export const useMyContracts = (enabled = true) => useQuery({ queryKey: ["me", "contracts"], queryFn: () => api<Contract[]>("/me/contracts"), enabled });
export const useMyContract = (id: string) => useQuery({ queryKey: ["me", "contracts", id], queryFn: () => api<Contract>(`/me/contracts/${id}`), enabled: !!id });
export const useMyInstallments = (status?: string) => useQuery({ queryKey: ["me", "installments", status ?? ""], queryFn: () => api<Installment[]>(`/me/installments${status ? `?status=${status}` : ""}`) });

export function useAcceptContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Contract>(`/me/contracts/${id}/accept`, { method: "POST", json: { accept: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "contracts"] }),
  });
}

export function useContacts<T>(resource: "phones" | "emails" | "addresses" | "family", enabled = true) {
  return useQuery({ queryKey: ["me", resource], queryFn: () => api<T[]>(`/me/${resource}`), enabled });
}

export function useContactMutation(resource: "phones" | "emails" | "addresses" | "family") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method, body }: { id?: string; method: "POST" | "PATCH" | "DELETE"; body?: unknown }) =>
      api<unknown>(`/me/${resource}${id ? `/${id}` : ""}`, { method, ...(body !== undefined ? { json: body } : {}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", resource] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api<unknown>("/auth/me", { method: "PATCH", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionContextKey }),
  });
}
