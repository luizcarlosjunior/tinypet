"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { NotificationRow } from "@/types/api";

export function useNotifications(enabled = true) {
  return useQuery({ queryKey: ["notifications"], queryFn: () => api<NotificationRow[]>("/notifications", { partnerId: null }), enabled, refetchInterval: 60_000, retry: 0 });
}
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api("/notifications", { method: "PATCH", partnerId: null }), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
}
/** Alias kept for shared components. */
export const useMarkNotificationsRead = useMarkAllRead;
