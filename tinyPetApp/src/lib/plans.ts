/** Display name of a plan key (the API only sends keys: owner_free, owner_plus, free, pro, business). */
const PLAN_NAME: Record<string, string> = { owner_free: "Free", owner_plus: "Plus", free: "Free", pro: "Pro", business: "Business" };

export function planName(key: string | null | undefined): string {
  if (!key) return "";
  return PLAN_NAME[key] ?? key.replace(/^owner_/, "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
