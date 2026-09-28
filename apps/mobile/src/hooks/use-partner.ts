import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientInput, PetInput } from "@tinypet/shared";
import { api, apiList, qs } from "@/lib/api";
import type { Appointment, Client, ClientInvite, DayRoute, Pet } from "@/lib/types";

// All hooks here rely on X-Partner-Id being set by the auth store (partner context).

export function useClients(q: string, partnerId: string | null) {
  return useQuery({ queryKey: ["clients", partnerId, q], queryFn: () => apiList<Client[]>(`/clients${qs({ q, pageSize: 50 })}`), enabled: !!partnerId });
}
export function useClient(id: string | undefined) {
  return useQuery({ queryKey: ["clients", "one", id], queryFn: () => api<Client>(`/clients/${id}`), enabled: !!id });
}
export function useClientInvites(id: string | undefined) {
  return useQuery({ queryKey: ["clients", "invites", id], queryFn: () => api<ClientInvite[]>(`/clients/${id}/invites`), enabled: !!id });
}
export function useClientMutations(id?: string) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["clients"] });
  const create = useMutation({ mutationFn: (input: ClientInput) => api<Client>("/clients", { method: "POST", json: input }), onSuccess: inv });
  const update = useMutation({ mutationFn: (input: Partial<ClientInput>) => api<Client>(`/clients/${id}`, { method: "PATCH", json: input }), onSuccess: inv });
  const createPet = useMutation({ mutationFn: (input: PetInput) => api<Pet>(`/clients/${id}/pets`, { method: "POST", json: input }), onSuccess: inv });
  const invite = useMutation({ mutationFn: (input: { email?: string; phone?: string }) => api<ClientInvite>(`/clients/${id}/invite`, { method: "POST", json: input }), onSuccess: inv });
  return { create, update, createPet, invite };
}

export function useScheduleAppointments(params: { from: string; to: string; membershipId?: string; status?: string; locationType?: string }, partnerId: string | null) {
  return useQuery({ queryKey: ["schedule", partnerId, params], queryFn: () => api<Appointment[]>(`/schedule/appointments${qs(params)}`), enabled: !!partnerId });
}
export function useScheduleAppointment(id: string | undefined) {
  return useQuery({ queryKey: ["schedule", "one", id], queryFn: () => api<Appointment>(`/schedule/appointments/${id}`), enabled: !!id });
}
export function useAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; status: Appointment["status"]; cancelReason?: string | null; report?: string | null; nextSteps?: string | null; reportPhotos?: string[] }) => api<Appointment>(`/schedule/appointments/${id}/status`, { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });
}
export function useDayRoute(date: string, membershipId: string | undefined, partnerId: string | null) {
  return useQuery({ queryKey: ["schedule", "day-route", partnerId, date, membershipId], queryFn: () => api<DayRoute>(`/schedule/day-route${qs({ date, membershipId })}`), enabled: !!partnerId });
}
export function useTeam(partnerId: string | null) {
  return useQuery({ queryKey: ["partners", partnerId, "members"], queryFn: () => api<{ id: string; role: string; jobTitle?: string | null; user?: { name: string } | null; navApp?: string | null }[]>(`/partners/${partnerId}/members`), enabled: !!partnerId });
}
