import { ApiClientError } from "./api-client";
import type { PlanLimitError } from "@tinypet/shared";

export function errorMessage(e: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  if (e instanceof ApiClientError) {
    if (e.code === "VALIDATION" && e.details && typeof e.details === "object") {
      const d = e.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | { issues?: { message: string }[] };
      if ("fieldErrors" in d && d.fieldErrors) {
        const first = Object.entries(d.fieldErrors)[0];
        if (first?.[1]?.[0]) return `${first[0]}: ${first[1][0]}`;
      }
      if ("issues" in d && d.issues?.[0]?.message) return d.issues[0].message;
    }
    return e.message || fallback;
  }
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

export function isPlanLimit(e: unknown): e is ApiClientError & { details: PlanLimitError } {
  return e instanceof ApiClientError && (e.status === 402 || e.code === "PLAN_LIMIT");
}
export function isNotFound(e: unknown) {
  return e instanceof ApiClientError && e.status === 404;
}
export function isForbidden(e: unknown) {
  return e instanceof ApiClientError && e.status === 403;
}

export function planLimitInfo(e: unknown): Partial<PlanLimitError> {
  if (!isPlanLimit(e)) return {};
  const d = (e.details ?? {}) as Partial<PlanLimitError>;
  return d;
}

/** Returns the PLAN_LIMIT payload or null (compat helper used by shared components). */
export function planLimitOf(e: unknown): PlanLimitError | null {
  if (!isPlanLimit(e)) return null;
  const d = (e.details ?? {}) as Partial<PlanLimitError>;
  return { code: "PLAN_LIMIT", featureKey: d.featureKey ?? "", current: d.current ?? 0, limit: d.limit ?? null, planKey: d.planKey ?? "" };
}
