"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import type { TeamMember } from "@/types/api";
import { sessionContextKey } from "@/hooks/use-session-context";

export function useMembers(partnerId: string | null) {
  return useQuery({ queryKey: ["partner", partnerId, "members"], queryFn: () => api<TeamMember[]>(`/partners/${partnerId}/members`), enabled: !!partnerId });
}

export function useTeamMutations(partnerId: string | null) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["partner", partnerId, "members"] });
    // usage bar / invite gate (team_members) and the caller's own membership (role, canSeeFinance)
    qc.invalidateQueries({ queryKey: ["partner", partnerId, "plan"] });
    qc.invalidateQueries({ queryKey: sessionContextKey });
  };
  const invite = useMutation({
    mutationFn: (body: unknown) => api<TeamMember>(`/partners/${partnerId}/members`, { method: "POST", json: body }),
    onSuccess: () => {
      invalidate();
      toast("Membro adicionado", "success");
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => api<TeamMember>(`/partners/${partnerId}/members/${id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      invalidate();
      toast("Membro atualizado", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/partners/${partnerId}/members/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast("Membro removido", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  return { invite, update, remove };
}
