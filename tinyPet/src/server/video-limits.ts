import { formatInTimeZone } from "date-fns-tz";
import { prisma, type Prisma } from "@/db";
import { VIDEO_LIMIT_FEATURES, VIDEO_DURATION_TOLERANCE_SECONDS, MEDIA_MAX_BYTES } from "@tinypet/shared";
import { ApiError } from "./errors";
import { getLimits, type Audience } from "./plans";

/**
 * Video plan limits: videos per day (America/Sao_Paulo calendar day) and max duration per video.
 * Features: PARTNER videos_per_day / video_max_seconds · OWNER owner_videos_per_day / owner_video_max_seconds.
 * A missing feature or a null quantity means "unlimited".
 */

export type VideoOwner = { audience: Audience; id: string };

/** A PENDING video older than this no longer counts toward the daily quota (abandoned upload). */
export const STALE_PENDING_MS = 60 * 60 * 1000;

/** Start of the current America/Sao_Paulo calendar day (fixed UTC−3, no DST since 2019), as an absolute instant. */
export function spDayStartUtc(now: Date = new Date()): Date {
  const day = formatInTimeZone(now, "America/Sao_Paulo", "yyyy-MM-dd");
  return new Date(`${day}T00:00:00-03:00`);
}

/** Prisma filter for the videos that count toward today's quota of `owner`. */
export function videoQuotaWhere(owner: VideoOwner, now: Date = new Date()): Prisma.MediaAssetWhereInput {
  return {
    ...(owner.audience === "PARTNER" ? { partnerId: owner.id } : { userId: owner.id, partnerId: null }),
    kind: "VIDEO",
    createdAt: { gte: spDayStartUtc(now) },
    OR: [{ status: { in: ["READY", "FLAGGED"] } }, { status: "PENDING", createdAt: { gte: new Date(now.getTime() - STALE_PENDING_MS) } }],
  };
}

/** Pure version of the counting rule (same semantics as videoQuotaWhere), used by tests and documentation. */
export function countsTowardVideoQuota(a: { kind: string; status: string; createdAt: Date }, now: Date = new Date()): boolean {
  if (a.kind !== "VIDEO" || a.createdAt < spDayStartUtc(now)) return false;
  if (a.status === "READY" || a.status === "FLAGGED") return true;
  return a.status === "PENDING" && a.createdAt.getTime() >= now.getTime() - STALE_PENDING_MS;
}

export type VideoLimits = { audience: Audience; planKey: string; videosPerDay: number | null; videosUsedToday: number; videoMaxSeconds: number | null; maxBytes: number };

function quantity(l: { enabled: boolean; quantity: number | null } | undefined): number | null {
  if (!l) return null;
  if (!l.enabled) return 0;
  return l.quantity;
}

export async function getVideoLimits(owner: VideoOwner, now: Date = new Date()): Promise<VideoLimits> {
  const keys = VIDEO_LIMIT_FEATURES[owner.audience];
  const [{ planKey, limits }, used] = await Promise.all([getLimits(owner.audience, owner.id), prisma.mediaAsset.count({ where: videoQuotaWhere(owner, now) })]);
  return { audience: owner.audience, planKey, videosPerDay: quantity(limits[keys.perDay]), videosUsedToday: used, videoMaxSeconds: quantity(limits[keys.maxSeconds]), maxBytes: MEDIA_MAX_BYTES };
}

export function durationLimitError(owner: VideoOwner, planKey: string, maxSeconds: number, durationSeconds: number) {
  return new ApiError(402, "PLAN_LIMIT", `Seu plano permite vídeos de até ${maxSeconds} segundos.`, {
    featureKey: VIDEO_LIMIT_FEATURES[owner.audience].maxSeconds,
    current: Math.round(durationSeconds),
    limit: maxSeconds,
    planKey,
  });
}

export function perDayLimitError(owner: VideoOwner, planKey: string, perDay: number, current: number) {
  return new ApiError(402, "PLAN_LIMIT", `Seu plano permite ${perDay} ${perDay === 1 ? "vídeo" : "vídeos"} por dia. Tente novamente amanhã ou faça upgrade.`, {
    featureKey: VIDEO_LIMIT_FEATURES[owner.audience].perDay,
    current,
    limit: perDay,
    planKey,
  });
}

/** Step 1 (upload request): declared duration ≤ plan max, and today's count < plan per-day. Throws 402 PLAN_LIMIT. */
export async function assertVideoPlanAllowed(owner: VideoOwner, declaredSeconds: number, now: Date = new Date()) {
  const l = await getVideoLimits(owner, now);
  if (l.videoMaxSeconds != null && declaredSeconds > l.videoMaxSeconds + VIDEO_DURATION_TOLERANCE_SECONDS) throw durationLimitError(owner, l.planKey, l.videoMaxSeconds, declaredSeconds);
  if (l.videosPerDay != null && l.videosUsedToday >= l.videosPerDay) throw perDayLimitError(owner, l.planKey, l.videosPerDay, l.videosUsedToday);
  return l;
}

/** Step 2 (finalize): real duration ≤ plan max + VIDEO_DURATION_TOLERANCE_SECONDS. Returns the 402 error or null. */
export async function videoDurationViolation(owner: VideoOwner, realSeconds: number): Promise<ApiError | null> {
  const { planKey, limits } = await getLimits(owner.audience, owner.id);
  const max = quantity(limits[VIDEO_LIMIT_FEATURES[owner.audience].maxSeconds]);
  if (max != null && realSeconds > max + VIDEO_DURATION_TOLERANCE_SECONDS) return durationLimitError(owner, planKey, max, realSeconds);
  return null;
}

/** Audience of an asset (partner asset → PARTNER, else OWNER), or null when it has no owner. */
export function videoOwnerOf(a: { userId: string | null; partnerId: string | null }): VideoOwner | null {
  if (a.partnerId) return { audience: "PARTNER", id: a.partnerId };
  if (a.userId) return { audience: "OWNER", id: a.userId };
  return null;
}
