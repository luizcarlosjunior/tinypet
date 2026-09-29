"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiList } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import type { CatalogItem, CatalogMedia } from "@/types/api";
import type { CatalogItemInput } from "@tinypet/shared";

export type CatalogParams = { status?: string; type?: string; q?: string };

function qs(p: Record<string, string | undefined>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : "";
}

export function useCatalog(partnerId: string | null, params: CatalogParams = {}) {
  return useQuery({
    queryKey: ["catalog", partnerId, params],
    // GET /catalog is paginated (default 20) → load every page so the list (grouped by type) is complete
    queryFn: async () => {
      const all: CatalogItem[] = [];
      for (let page = 1; page <= 50; page++) {
        const r = await apiList<CatalogItem[]>(`/catalog${qs({ ...params, page: String(page), pageSize: "100" })}`);
        all.push(...(r.data ?? []));
        if (!r.meta || all.length >= r.meta.total || (r.data ?? []).length === 0) break;
      }
      return all;
    },
    enabled: !!partnerId,
  });
}
export function useCatalogItem(partnerId: string | null, id: string | null) {
  return useQuery({ queryKey: ["catalog", partnerId, "item", id], queryFn: () => api<CatalogItem>(`/catalog/${id}`), enabled: !!partnerId && !!id && id !== "novo" });
}

export function useSaveCatalogItem() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, body, media }: { id?: string; body: Partial<CatalogItemInput>; media?: CatalogMedia[] }) => {
      const item = id ? await api<CatalogItem>(`/catalog/${id}`, { method: "PATCH", json: body }) : await api<CatalogItem>("/catalog", { method: "POST", json: body });
      if (media) await api(`/catalog/${item.id}/media`, { method: "PUT", json: { media } });
      return item;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["partner"] });
      toast("Item salvo", "success");
    },
  });
}
export function useDeleteCatalogItem() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api(`/catalog/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["partner"] });
      toast("Item removido", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
}
export function useUpdateCatalogStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CatalogItem["status"] }) => api(`/catalog/${id}`, { method: "PATCH", json: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast("Status atualizado", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
}
