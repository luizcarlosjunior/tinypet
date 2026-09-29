import type { CatalogItem } from "@/types/api";

export const ITEM_STATUS_LABEL: Record<CatalogItem["status"], string> = { DRAFT: "Rascunho", PUBLISHED: "Publicado", PAUSED: "Pausado" };
export const ITEM_STATUS_TONE: Record<CatalogItem["status"], "gray" | "green" | "amber"> = { DRAFT: "gray", PUBLISHED: "green", PAUSED: "amber" };
export const SERVICE_LOCATION_LABEL: Record<"PARTNER_VENUE" | "CLIENT_HOME" | "ONLINE", string> = { PARTNER_VENUE: "No estabelecimento", CLIENT_HOME: "A domicílio", ONLINE: "Online" };
export const SERVICE_LOCATIONS = ["PARTNER_VENUE", "CLIENT_HOME", "ONLINE"] as const;

export function coverOf(item: CatalogItem): string | null {
  const m = item.media ?? [];
  const c = m.find((x) => x.isCover) ?? m[0];
  return c ? c.thumbUrl || c.url : null;
}
