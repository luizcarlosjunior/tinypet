import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PetInput } from "@tinypet/shared";
import { api, qs } from "@/lib/api";
import type { Badge, FoodSuggestion, HistoryEvent, Measurement, MeasurementsResponse, Pet, PetFood, PetMedia, PetSkill, PetTask, SkillComparison, SkillsResponse, Vaccination } from "@/lib/types";

/**
 * Pet endpoints are the same for owners and partner members; partner context is carried by X-Partner-Id.
 * `basePath` lets partner screens reuse these hooks for pets reached through the CRM.
 */
export const petKeys = {
  all: ["pets"] as const,
  one: (id: string) => ["pets", id] as const,
  sub: (id: string, part: string, extra?: unknown) => ["pets", id, part, extra] as const,
};

export function usePets(includeDeceased = false) {
  return useQuery({ queryKey: [...petKeys.all, { includeDeceased }], queryFn: () => api<Pet[]>(`/pets${qs({ includeDeceased: includeDeceased || undefined })}`) });
}
export function usePet(id: string | undefined) {
  return useQuery({ queryKey: petKeys.one(id ?? ""), queryFn: () => api<Pet>(`/pets/${id}`), enabled: !!id });
}
export function usePetMutations(id?: string) {
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: petKeys.all });
    qc.invalidateQueries({ queryKey: ["me", "home"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };
  const create = useMutation({ mutationFn: (input: PetInput) => api<Pet>("/pets", { method: "POST", json: input }), onSuccess: inv });
  const update = useMutation({ mutationFn: (input: Partial<PetInput>) => api<Pet>(`/pets/${id}`, { method: "PATCH", json: input }), onSuccess: inv });
  const remove = useMutation({ mutationFn: () => api(`/pets/${id}`, { method: "DELETE" }), onSuccess: inv });
  /** Irreversible. Requires `password` (or `code` from sendDeceasedCode for accounts without a password). */
  const markDeceased = useMutation({
    mutationFn: (input: { deceasedAt: string; memorialNote?: string | null; password?: string; code?: string }) => api(`/pets/${id}/deceased`, { method: "POST", json: input }),
    onSuccess: inv,
  });
  const sendDeceasedCode = useMutation({ mutationFn: () => api(`/pets/${id}/deceased/code`, { method: "POST" }) });
  return { create, update, remove, markDeceased, sendDeceasedCode };
}

// ── gallery ──
export function usePetMedia(id: string, story?: boolean) {
  return useQuery({ queryKey: petKeys.sub(id, "media", story), queryFn: () => api<PetMedia[]>(`/pets/${id}/media${qs({ story: story ? 1 : undefined })}`) });
}
export function usePetMediaMutations(id: string) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: petKeys.sub(id, "media") });
  const create = useMutation({ mutationFn: (input: Record<string, unknown>) => api<PetMedia>(`/pets/${id}/media`, { method: "POST", json: input }), onSuccess: inv });
  const remove = useMutation({ mutationFn: (mid: string) => api(`/pets/${id}/media/${mid}`, { method: "DELETE" }), onSuccess: inv });
  return { create, remove };
}

// ── history ──
export function usePetHistory(id: string) {
  return useQuery({ queryKey: petKeys.sub(id, "history"), queryFn: () => api<HistoryEvent[]>(`/pets/${id}/history`) });
}
export function useAddHistory(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: Record<string, unknown>) => api(`/pets/${id}/history`, { method: "POST", json: input }), onSuccess: () => qc.invalidateQueries({ queryKey: petKeys.sub(id, "history") }) });
}

// ── health ──
export function useVaccinations(id: string) {
  return useQuery({ queryKey: petKeys.sub(id, "vaccinations"), queryFn: () => api<Vaccination[]>(`/pets/${id}/vaccinations`) });
}
export function useVaccinationMutations(id: string) {
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: petKeys.sub(id, "vaccinations") });
    qc.invalidateQueries({ queryKey: petKeys.sub(id, "history") });
  };
  const create = useMutation({ mutationFn: (input: Record<string, unknown>) => api(`/pets/${id}/vaccinations`, { method: "POST", json: input }), onSuccess: inv });
  const remove = useMutation({ mutationFn: (vid: string) => api(`/pets/${id}/vaccinations/${vid}`, { method: "DELETE" }), onSuccess: inv });
  return { create, remove };
}
export function useMeasurements(id: string, period: "6m" | "1y" | "all" = "6m") {
  return useQuery({ queryKey: petKeys.sub(id, "measurements", period), queryFn: () => api<MeasurementsResponse | Measurement[]>(`/pets/${id}/measurements${qs({ period })}`) });
}
export function useMeasurementMutations(id: string) {
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: petKeys.sub(id, "measurements") });
    qc.invalidateQueries({ queryKey: petKeys.sub(id, "history") });
  };
  const create = useMutation({ mutationFn: (input: Record<string, unknown>) => api(`/pets/${id}/measurements`, { method: "POST", json: input }), onSuccess: inv });
  const remove = useMutation({ mutationFn: (mid: string) => api(`/pets/${id}/measurements/${mid}`, { method: "DELETE" }), onSuccess: inv });
  return { create, remove };
}

// ── skills ──
export function useSkills(id: string) {
  return useQuery({ queryKey: petKeys.sub(id, "skills"), queryFn: () => api<SkillsResponse>(`/pets/${id}/skills`) });
}
export function useSkillComparison(id: string, filters: Record<string, string | number | boolean | undefined>, enabled = true) {
  return useQuery({ queryKey: petKeys.sub(id, "skills-comparison", filters), queryFn: () => api<SkillComparison>(`/pets/${id}/skills/comparison${qs(filters)}`), enabled });
}
export function useSkillMutations(id: string) {
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: petKeys.sub(id, "skills") });
    qc.invalidateQueries({ queryKey: petKeys.sub(id, "skills-comparison") });
  };
  const upsert = useMutation({ mutationFn: (input: { skillId?: string; customName?: string; level: PetSkill["level"]; masteredAt?: string | null }) => api(`/pets/${id}/skills`, { method: "PUT", json: input }), onSuccess: inv });
  const remove = useMutation({ mutationFn: (sid: string) => api(`/pets/${id}/skills/${sid}`, { method: "DELETE" }), onSuccess: inv });
  const validate = useMutation({ mutationFn: (sid: string) => api(`/pets/${id}/skills/${sid}/validate`, { method: "POST" }), onSuccess: inv });
  return { upsert, remove, validate };
}

// ── tasks ──
export function useTasks(id: string) {
  return useQuery({ queryKey: petKeys.sub(id, "tasks"), queryFn: () => api<PetTask[]>(`/pets/${id}/tasks`) });
}
export function useTaskTemplates(id: string, enabled: boolean) {
  return useQuery({ queryKey: petKeys.sub(id, "task-templates"), queryFn: () => api<{ title: string; description?: string | null; rule?: PetTask["rule"] }[]>(`/pets/${id}/tasks/templates`), enabled });
}
export function useTaskMutations(petId: string) {
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: petKeys.sub(petId, "tasks") });
    qc.invalidateQueries({ queryKey: ["me", "home"] });
  };
  const create = useMutation({ mutationFn: (input: Record<string, unknown>) => api(`/pets/${petId}/tasks`, { method: "POST", json: input }), onSuccess: inv });
  const complete = useMutation({ mutationFn: ({ tid, forDate }: { tid: string; forDate?: string }) => api(`/pets/${petId}/tasks/${tid}/complete`, { method: "POST", json: { forDate } }), onSuccess: inv });
  const accept = useMutation({ mutationFn: (tid: string) => api(`/pets/${petId}/tasks/${tid}/accept`, { method: "POST" }), onSuccess: inv });
  const remove = useMutation({ mutationFn: (tid: string) => api(`/pets/${petId}/tasks/${tid}`, { method: "DELETE" }), onSuccess: inv });
  return { create, complete, accept, remove };
}

// ── foods ──
export function useFoods(id: string) {
  return useQuery({ queryKey: petKeys.sub(id, "foods"), queryFn: () => api<PetFood[]>(`/pets/${id}/foods`) });
}
export function useFoodSuggestions(id: string, enabled = true) {
  return useQuery({ queryKey: petKeys.sub(id, "food-suggestions"), queryFn: () => api<FoodSuggestion[]>(`/pets/${id}/foods/suggestions`), enabled });
}
export function useFoodMutations(id: string) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: petKeys.sub(id, "foods") });
  const create = useMutation({ mutationFn: (input: Record<string, unknown>) => api(`/pets/${id}/foods`, { method: "POST", json: input }), onSuccess: inv });
  const remove = useMutation({ mutationFn: (fid: string) => api(`/pets/${id}/foods/${fid}`, { method: "DELETE" }), onSuccess: inv });
  return { create, remove };
}

// ── badges ──
export function useBadges(id: string) {
  return useQuery({ queryKey: petKeys.sub(id, "badges"), queryFn: () => api<Badge[]>(`/pets/${id}/badges`) });
}
