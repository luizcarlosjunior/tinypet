"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiList } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { errorMessage, isPlanLimit } from "@/lib/errors";
import type { Client, ClientInvite, Contract, Appointment, FamilyMemberRow, Pet, PetHistoryEvent, Measurement, Vaccination, PetSkillRow } from "@/types/api";

export type ClientListParams = { q?: string; tag?: string; species?: string; birthdayMonth?: number; page?: number; pageSize?: number };

function qs(params: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function useClients(params: ClientListParams, partnerId: string | null) {
  return useQuery({ queryKey: ["clients", partnerId, params], queryFn: () => apiList<Client[]>(`/clients${qs(params)}`), enabled: !!partnerId, placeholderData: (prev) => prev });
}
export function useClient(id: string | null) {
  return useQuery({ queryKey: ["client", id], queryFn: () => api<Client>(`/clients/${id}`), enabled: !!id });
}
export function useClientInvites(id: string | null) {
  return useQuery({ queryKey: ["client", id, "invites"], queryFn: () => api<ClientInvite[]>(`/clients/${id}/invites`), enabled: !!id });
}
export function useClientFamily(id: string | null) {
  return useQuery({ queryKey: ["client", id, "family"], queryFn: () => api<FamilyMemberRow[]>(`/clients/${id}/family`), enabled: !!id });
}
export function useClientContracts(id: string | null, enabled = true) {
  return useQuery({ queryKey: ["contracts", { clientId: id }], queryFn: () => apiList<Contract[]>(`/finance/contracts?clientId=${id}`), enabled: !!id && enabled, retry: 0 });
}
export function useClientAppointments(id: string | null, from: string, to: string) {
  return useQuery({
    // under ["schedule"] so appointment mutations (useInvalidateSchedule) refresh the client tab too
    queryKey: ["schedule", "client-appointments", { clientId: id, from, to }],
    queryFn: async () => {
      const r = await apiList<Appointment[]>(`/schedule/appointments?clientId=${encodeURIComponent(id ?? "")}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      return (r.data ?? []).filter((a) => a.clientId === id || a.client?.id === id);
    },
    enabled: !!id,
  });
}
export type Birthdays = { clients: (Client & { birthDate: string })[]; pets: (Pet & { birthDate: string; clients?: { id: string; name: string; primaryPhone?: string | null }[] })[] };
export function useBirthdays(month: number, partnerId: string | null) {
  return useQuery({ queryKey: ["clients", partnerId, "birthdays", month], queryFn: () => api<Birthdays>(`/clients/birthdays?month=${month}`), enabled: !!partnerId });
}

export function usePet(id: string | null) {
  return useQuery({ queryKey: ["pet", id], queryFn: () => api<Pet>(`/pets/${id}`), enabled: !!id });
}
export function usePetHistory(id: string | null) {
  return useQuery({ queryKey: ["pet", id, "history"], queryFn: () => api<PetHistoryEvent[]>(`/pets/${id}/history`), enabled: !!id });
}
export type MeasurementsData = { items: Measurement[]; lifeStage?: "PUPPY" | "ADULT" | "SENIOR" | null; reference?: { minWeightG: number; maxWeightG: number } | null; alerts?: (string | { message: string })[] };
export function usePetMeasurements(id: string | null, period: "6m" | "1y" | "all") {
  return useQuery({ queryKey: ["pet", id, "measurements", period], queryFn: () => api<MeasurementsData>(`/pets/${id}/measurements?period=${period}`), enabled: !!id });
}
export function usePetVaccinations(id: string | null) {
  return useQuery({ queryKey: ["pet", id, "vaccinations"], queryFn: () => api<Vaccination[]>(`/pets/${id}/vaccinations`), enabled: !!id });
}
export type SkillsData = { skills: PetSkillRow[]; available: { id: string; name: string; speciesKey?: string | null }[] };
export function usePetSkills(id: string | null) {
  return useQuery({ queryKey: ["pet", id, "skills"], queryFn: () => api<SkillsData>(`/pets/${id}/skills`), enabled: !!id });
}
export type TaskRow = { id: string; title: string; description?: string | null; rule?: { freq: "daily" | "weekly"; days?: number[]; times?: string[] } | null; dueAt?: string | null; status: "PROPOSED" | "ACTIVE" | "PAUSED" | "DONE" | "CANCELED" | string; createdAt?: string };
export function usePetTasks(id: string | null) {
  return useQuery({ queryKey: ["pet", id, "tasks"], queryFn: async () => {
      // GET /pets/:id/tasks → { date, tasks, today }
      const d = await api<TaskRow[] | { tasks: TaskRow[] }>(`/pets/${id}/tasks`);
      return Array.isArray(d) ? d : d?.tasks ?? [];
    }, enabled: !!id });
}

/** Generic mutation helper: `api(path, {method, json})` → invalidates keys + toast. */
export function useApiMutation<TVars = unknown, TData = unknown>(opts: { path: (v: TVars) => string; method?: string | ((v: TVars) => string); body?: (v: TVars) => unknown; invalidate: unknown[][] | ((v: TVars) => unknown[][]); success?: string; onSuccess?: (data: TData, v: TVars) => void; silentError?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation<TData, unknown, TVars>({
    mutationFn: (v) => api<TData>(opts.path(v), { method: typeof opts.method === "function" ? opts.method(v) : opts.method ?? "POST", json: opts.body ? opts.body(v) : undefined }),
    onSuccess: (data, v) => {
      const keys = typeof opts.invalidate === "function" ? opts.invalidate(v) : opts.invalidate;
      keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (opts.success) toast(opts.success, "success");
      opts.onSuccess?.(data, v);
    },
    onError: (e) => {
      if (!opts.silentError && !isPlanLimit(e)) toast(errorMessage(e), "error");
    },
  });
}
