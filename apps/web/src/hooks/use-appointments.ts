"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type AppointmentAddress = { id?: string; street?: string | null; number?: string | null; district?: string | null; city?: string | null; state?: string | null; complement?: string | null; latitude?: number | string | null; longitude?: number | string | null };
export type Appointment = {
  id: string;
  partnerId: string;
  partner?: { id: string; tradeName: string; slug: string; logoUrl: string | null; cancellationHours?: number } | null;
  title: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  locationType: "CLIENT_HOME" | "PARTNER_VENUE" | "OTHER" | "ONLINE";
  status: "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  item?: { id: string; name: string; price?: string | number | null } | null;
  pets?: { pet?: { id: string; name: string; avatarUrl: string | null } ; petId?: string; id?: string; name?: string }[];
  address?: AppointmentAddress | null;
  membership?: { id: string; user?: { name: string } | null } | null;
  notes: string | null;
  report?: string | null;
  cancelReason?: string | null;
  locationNotes?: string | null;
};

export const appointmentsKey = ["me", "appointments"] as const;

export function useMyAppointments(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: [...appointmentsKey, from, to],
    queryFn: () => api<Appointment[]>(`/me/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    enabled,
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api<Appointment>(`/me/appointments/${id}/cancel`, { method: "POST", json: { reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appointmentsKey });
      qc.invalidateQueries({ queryKey: ["me", "home"] });
    },
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, startsAt }: { id: string; startsAt: string }) => api<Appointment>(`/me/appointments/${id}/reschedule`, { method: "POST", json: { startsAt } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appointmentsKey });
      qc.invalidateQueries({ queryKey: ["me", "home"] });
    },
  });
}

export type Slot = { startsAt: string; endsAt: string; membershipId: string; membershipName?: string };

export function useSlots(slug: string, itemId: string, date: string | null) {
  return useQuery({
    queryKey: ["public", "slots", slug, itemId, date],
    queryFn: () => api<Slot[]>(`/public/partners/${slug}/slots?itemId=${itemId}&date=${date}`),
    enabled: !!slug && !!itemId && !!date,
    retry: false,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { partnerId: string; itemId: string; petIds: string[]; startsAt: string; locationType?: string; addressId?: string | null; notes?: string | null }) =>
      api<Appointment>("/bookings", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: appointmentsKey }),
  });
}
