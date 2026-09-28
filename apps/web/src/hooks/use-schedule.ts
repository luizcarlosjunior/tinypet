"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import type { Appointment, Availability, DayRoute, TeamMember, TimeOff, Client, CatalogItem } from "@/types/api";
import type { AppointmentInput } from "@tinypet/shared";

export type AgendaFilters = { membershipId?: string | null; locationType?: string | null; status?: string | null };

export function agendaKey(from: string, to: string, f: AgendaFilters) {
  return ["schedule", "appointments", from, to, f.membershipId ?? "", f.locationType ?? "", f.status ?? ""] as const;
}

export function useAppointments(range: { from: string; to: string }, filters: AgendaFilters = {}, enabled = true) {
  const qs = new URLSearchParams({ from: range.from, to: range.to });
  if (filters.membershipId) qs.set("membershipId", filters.membershipId);
  if (filters.locationType) qs.set("locationType", filters.locationType);
  if (filters.status) qs.set("status", filters.status);
  return useQuery({ queryKey: agendaKey(range.from, range.to, filters), queryFn: () => api<Appointment[]>(`/schedule/appointments?${qs.toString()}`), enabled: enabled && !!range.from && !!range.to });
}

export function useAppointment(id: string | null) {
  return useQuery({ queryKey: ["schedule", "appointment", id], queryFn: () => api<Appointment>(`/schedule/appointments/${id}`), enabled: !!id });
}

export function useDayRoute(date: string, membershipId: string | null | undefined, enabled = true) {
  const qs = new URLSearchParams({ date });
  if (membershipId) qs.set("membershipId", membershipId);
  return useQuery({ queryKey: ["schedule", "day-route", date, membershipId ?? ""], queryFn: () => api<DayRoute>(`/schedule/day-route?${qs.toString()}`), enabled: enabled && !!date, retry: 0 });
}

export function useMembers(partnerId: string | null) {
  return useQuery({ queryKey: ["partner", partnerId, "members"], queryFn: () => api<TeamMember[]>(`/partners/${partnerId}/members`), enabled: !!partnerId, staleTime: 60_000 });
}

export function useServices() {
  return useQuery({ queryKey: ["catalog", "services"], queryFn: () => api<CatalogItem[]>(`/catalog?type=SERVICE`), staleTime: 60_000 });
}

export function useClientDetail(id: string | null) {
  return useQuery({ queryKey: ["clients", id], queryFn: () => api<Client>(`/clients/${id}`), enabled: !!id });
}

export function useAvailability(membershipId: string | null) {
  return useQuery({ queryKey: ["schedule", "availability", membershipId], queryFn: () => api<Availability | Availability["slots"]>(`/schedule/availability?membershipId=${membershipId}`), enabled: !!membershipId });
}
export function useTimeOffs(membershipId: string | null) {
  return useQuery({ queryKey: ["schedule", "time-off", membershipId], queryFn: () => api<TimeOff[]>(`/schedule/time-off?membershipId=${membershipId}`), enabled: !!membershipId });
}

function useInvalidateSchedule() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["schedule"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useSaveAppointment() {
  const inv = useInvalidateSchedule();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<AppointmentInput> }) => api<Appointment>(id ? `/schedule/appointments/${id}` : "/schedule/appointments", { method: id ? "PATCH" : "POST", json: body }),
    onSuccess: (_d, v) => {
      inv();
      toast(v.id ? "Agendamento atualizado" : "Agendamento criado", "success");
    },
  });
}

export function useAppointmentStatus() {
  const inv = useInvalidateSchedule();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status: string; cancelReason?: string | null; report?: string | null; nextSteps?: string | null; reportPhotos?: string[] } }) => api<Appointment>(`/schedule/appointments/${id}/status`, { method: "POST", json: body }),
    onSuccess: () => {
      inv();
      toast("Status atualizado", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
}

export function useDeleteAppointment() {
  const inv = useInvalidateSchedule();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api(`/schedule/appointments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      inv();
      toast("Agendamento excluído", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
}

export function useApplySuggestion() {
  const inv = useInvalidateSchedule();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (changes: { appointmentId: string; startsAt: string }[]) => {
      for (const c of changes) await api(`/schedule/appointments/${c.appointmentId}`, { method: "PATCH", json: { startsAt: c.startsAt } });
    },
    onSuccess: () => {
      inv();
      toast("Sugestão aplicada", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
}

export function useSaveAvailability(membershipId: string | null) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (slots: Availability["slots"]) => api(`/schedule/availability?membershipId=${membershipId}`, { method: "PUT", json: { slots } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", "availability", membershipId] });
      toast("Disponibilidade salva", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
}

export function useCreateTimeOff(membershipId: string | null) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (body: { startsAt: string; endsAt: string; reason?: string | null }) => api(`/schedule/time-off?membershipId=${membershipId}`, { method: "POST", json: { ...body, membershipId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", "time-off", membershipId] });
      toast("Bloqueio criado", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
}
export function useDeleteTimeOff(membershipId: string | null) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api(`/schedule/time-off/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", "time-off", membershipId] });
      toast("Bloqueio removido", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
}
