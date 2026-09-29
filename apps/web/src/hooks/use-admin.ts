"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiList } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";

export type AdminRow = { id: string; [k: string]: unknown };
export type ListMeta = { page: number; pageSize: number; total: number };

function qs(params?: Record<string, string | number | boolean | undefined | null>) {
  if (!params) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Lists `/admin/<resource>`; accepts an array, `{ items }` or a paginated envelope. */
export async function fetchAdminList<T = AdminRow>(resource: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<{ items: T[]; meta?: ListMeta }> {
  const res = await apiList<T[] | { items: T[] } | { data: T[] }>(`/admin/${resource}${qs(params)}`, { partnerId: null });
  const d = res.data as unknown;
  if (Array.isArray(d)) return { items: d, meta: res.meta };
  if (d && typeof d === "object" && Array.isArray((d as { items?: T[] }).items)) return { items: (d as { items: T[] }).items, meta: res.meta };
  if (d && typeof d === "object" && Array.isArray((d as { data?: T[] }).data)) return { items: (d as { data: T[] }).data, meta: res.meta };
  return { items: [], meta: res.meta };
}

export function useAdminList<T = AdminRow>(resource: string, params?: Record<string, string | number | boolean | undefined | null>, enabled = true) {
  return useQuery({ queryKey: ["admin", resource, params ?? {}], queryFn: () => fetchAdminList<T>(resource, params), enabled });
}

export function useAdminMutations(resource: string, opts?: { invalidate?: string[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", resource] });
    for (const r of opts?.invalidate ?? []) qc.invalidateQueries({ queryKey: ["admin", r] });
    qc.invalidateQueries({ queryKey: ["ref"] });
  };
  const onError = (e: unknown) => toast(errorMessage(e), "error");
  const create = useMutation({
    mutationFn: (body: unknown) => api<AdminRow>(`/admin/${resource}`, { method: "POST", json: body, partnerId: null }),
    onSuccess: () => {
      invalidate();
      toast("Criado", "success");
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => api<AdminRow>(`/admin/${resource}/${id}`, { method: "PATCH", json: body, partnerId: null }),
    onSuccess: () => {
      invalidate();
      toast("Salvo", "success");
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/${resource}/${id}`, { method: "DELETE", partnerId: null }),
    onSuccess: () => {
      invalidate();
      toast("Removido", "success");
    },
    onError,
  });
  const post = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => api(`/admin/${resource}/${path}`, { method: "POST", json: body ?? {}, partnerId: null }),
    onSuccess: () => {
      invalidate();
      toast("Feito", "success");
    },
    onError,
  });
  return { create, update, remove, post, invalidate };
}

/* ───────── specific ───────── */
export type AdminUser = { id: string; name: string; email: string; role: "USER" | "ADMIN" | "EDITOR"; plan?: string | null; planKey?: string | null; createdAt?: string; subscription?: { plan?: { key: string } } | null };
export type AdminPartner = { id: string; tradeName: string; slug: string; plan?: string | null; planKey?: string | null; featured: boolean; published: boolean; createdAt?: string; logoUrl?: string | null; subscription?: { plan?: { key: string } } | null };
export type AdminPlan = { id: string; key: string; name: string; audience: "OWNER" | "PARTNER"; priceMonthly?: number | string | null; priceYearly?: number | string | null; trialDays?: number; visible?: boolean; isDefault?: boolean; sortOrder?: number; limits?: { featureKey: string; enabled: boolean; quantity: number | null }[] };
export type AdminFeature = { key: string; module?: string; label?: string; kind?: "BOOLEAN" | "QUANTITY"; audience?: "OWNER" | "PARTNER" };
export type AdminReport = { id: string; reason: string; status: "OPEN" | "RESOLVED" | "DISMISSED"; createdAt: string; reporter?: { id: string; name: string; email?: string } | null; review?: { id: string; rating?: number; comment?: string | null; status?: string; user?: { name: string } | null } | null; mediaAssetId?: string | null; mediaAsset?: { id: string; url: string; thumbUrl?: string | null } | null };
export type AdminMedia = { id: string; url: string; thumbUrl?: string | null; kind: "IMAGE" | "VIDEO"; purpose: string; status: string; createdAt?: string; partner?: { tradeName: string } | null; user?: { name: string } | null };

export function useAdminUsers(q: string, page: number) {
  return useAdminList<AdminUser>("users", { q, page, pageSize: 20 });
}
export function useAdminPartners(q: string, page: number) {
  return useAdminList<AdminPartner>("partners", { q, page, pageSize: 20 });
}
export function useAdminPlans() {
  return useAdminList<AdminPlan>("plans");
}
export function useAdminFeatures() {
  return useAdminList<AdminFeature>("features");
}
export function useAdminReports(status: string) {
  return useAdminList<AdminReport>("reports", { status });
}
export function useAdminFlaggedMedia() {
  // moderation queue: take the max page (API default is 20); the grid shows "N de total" when more remain
  return useAdminList<AdminMedia>("media", { status: "FLAGGED", pageSize: 100 });
}
export function useModerate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const onError = (e: unknown) => toast(errorMessage(e), "error");
  const report = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "HIDE" | "RESTORE" | "DISMISS" }) => api(`/admin/reports/${id}`, { method: "POST", json: { action }, partnerId: null }),
    onSuccess: () => {
      // report HIDE on media rejects the asset; media APPROVE/REJECT resolves its reports → refresh both lists
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
      qc.invalidateQueries({ queryKey: ["admin", "media"] });
      toast("Denúncia atualizada", "success");
    },
    onError,
  });
  const media = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "APPROVE" | "REJECT" }) => api(`/admin/media/${id}`, { method: "POST", json: { action }, partnerId: null }),
    onSuccess: () => {
      // report HIDE on media rejects the asset; media APPROVE/REJECT resolves its reports → refresh both lists
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
      qc.invalidateQueries({ queryKey: ["admin", "media"] });
      toast("Mídia moderada", "success");
    },
    onError,
  });
  return { report, media };
}
