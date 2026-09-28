/** Shared API response envelope. */
export type ApiOk<T> = { ok: true; data: T; meta?: { page: number; pageSize: number; total: number } };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export type PlanLimitError = {
  code: "PLAN_LIMIT";
  featureKey: string;
  current: number;
  limit: number | null;
  planKey: string;
};

export type SessionContext = {
  user: { id: string; name: string; email: string; role: "USER" | "ADMIN"; avatarUrl: string | null; ownerTerm: string };
  memberships: { partnerId: string; partnerName: string; slug: string; role: "OWNER" | "STAFF"; canSeeFinance: boolean; logoUrl: string | null }[];
};

export type Slot = { startsAt: string; endsAt: string; membershipId: string };
