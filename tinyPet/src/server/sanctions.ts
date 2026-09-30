import { prisma, type SanctionKind } from "@/db";
import { IP_BLOCK_DAYS, type SanctionDuration } from "@tinypet/shared";
import { ApiError } from "./errors";

/** Stored in `User.suspendedUntil` for permanent suspensions. */
export const PERMANENT_UNTIL = new Date("9999-12-31T00:00:00.000Z");
const DAY = 86_400_000;

/** IPs we can't attribute to a client (no TRUST_PROXY, loopback, private ranges) are never blocked nor recorded. */
export function isAttributableIp(ip: string | null | undefined): ip is string {
  if (!ip || ip === "0.0.0.0" || ip === "::" || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("::ffff:127.")) return false;
  return !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80:)/i.test(ip);
}

export function sanctionEndsAt(duration: SanctionDuration, from = new Date()): Date | null {
  return duration === "PERMANENT" ? null : new Date(from.getTime() + duration * DAY);
}

const activeWhere = (now = new Date()) => ({ revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] });

const fmtDay = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

/** 403 ACCOUNT_SUSPENDED with the end date (or permanent) in pt-BR. */
export function accountSuspendedError(until: Date) {
  const permanent = until.getTime() >= PERMANENT_UNTIL.getTime();
  const message = permanent ? "Sua conta foi bloqueada permanentemente por violar as regras da comunidade." : `Sua conta está suspensa até ${fmtDay(until)} por violar as regras da comunidade.`;
  return new ApiError(403, "ACCOUNT_SUSPENDED", message, { until: permanent ? null : until.toISOString(), permanent });
}

/** Throws when `suspendedUntil` (denormalized on User) is in the future. */
export function assertNotSuspended(u: { suspendedUntil: Date | null }) {
  if (u.suspendedUntil && u.suspendedUntil.getTime() > Date.now()) throw accountSuspendedError(u.suspendedUntil);
}

/** Recomputes `User.suspendedUntil` from the active ACCOUNT_SUSPENSION sanctions (after create/revoke). */
export async function syncSuspension(userId: string) {
  const rows = await prisma.userSanction.findMany({ where: { userId, kind: "ACCOUNT_SUSPENSION", ...activeWhere() }, select: { endsAt: true } });
  const until = rows.length === 0 ? null : rows.some((r) => r.endsAt === null) ? PERMANENT_UNTIL : new Date(Math.max(...rows.map((r) => r.endsAt!.getTime())));
  await prisma.user.update({ where: { id: userId }, data: { suspendedUntil: until, ...(until ? { tokenVersion: { increment: 1 } } : {}) } });
  if (until) await prisma.session.deleteMany({ where: { userId } });
  invalidateIpCache();
}

// ── IP blocks (checked on every API request by handler(); cached briefly) ──

let ipCache: { at: number; ips: Set<string> } | null = null;
const IP_CACHE_MS = 30_000;

export function invalidateIpCache() {
  ipCache = null;
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!isAttributableIp(ip)) return false;
  if (!ipCache || Date.now() - ipCache.at > IP_CACHE_MS) {
    const rows = await prisma.userSanction.findMany({ where: { kind: "IP_BLOCK", ip: { not: null }, ...activeWhere() }, select: { ip: true } });
    ipCache = { at: Date.now(), ips: new Set(rows.map((r) => r.ip!)) };
  }
  return ipCache.ips.has(ip);
}

export const ipBlockedError = () => new ApiError(403, "IP_BLOCKED", "Acesso bloqueado temporariamente por violação das regras da comunidade.");

/** 403 REPORT_BANNED when the user is barred from filing reports. */
export async function assertCanReport(userId: string) {
  const s = await prisma.userSanction.findFirst({ where: { userId, kind: "REPORT_BAN", ...activeWhere() }, orderBy: { endsAt: { sort: "desc", nulls: "first" } }, select: { endsAt: true } });
  if (!s) return;
  throw new ApiError(403, "REPORT_BANNED", s.endsAt ? `Você não pode fazer denúncias até ${fmtDay(s.endsAt)} por denúncias que não procediam.` : "Você não pode mais fazer denúncias por denúncias que não procediam.", { until: s.endsAt?.toISOString() ?? null });
}

export type NewSanction = { userId: string; kind: SanctionKind; duration: SanctionDuration; reason: string; createdById: string; ip?: string | null; mediaAssetId?: string | null; mediaReportId?: string | null };

/** Creates a sanction and applies it (suspension → kills sessions/tokens; IP block → cache refresh). */
export async function createSanction(s: NewSanction) {
  if (s.kind === "IP_BLOCK" && !isAttributableIp(s.ip)) throw new ApiError(400, "BAD_REQUEST", "IP desconhecido: não é possível bloquear o IP deste usuário");
  const duration = s.kind === "IP_BLOCK" ? IP_BLOCK_DAYS : s.duration;
  const row = await prisma.userSanction.create({
    data: { userId: s.userId, kind: s.kind, ip: s.kind === "IP_BLOCK" ? s.ip : null, reason: s.reason, endsAt: sanctionEndsAt(duration), mediaAssetId: s.mediaAssetId ?? null, mediaReportId: s.mediaReportId ?? null, createdById: s.createdById },
  });
  if (s.kind === "ACCOUNT_SUSPENSION") await syncSuspension(s.userId);
  if (s.kind === "IP_BLOCK") invalidateIpCache();
  return row;
}

export async function revokeSanction(id: string, adminId: string) {
  const s = await prisma.userSanction.findUnique({ where: { id } });
  if (!s) throw new ApiError(404, "NOT_FOUND", "Sanção não encontrada");
  if (s.revokedAt) return s;
  const row = await prisma.userSanction.update({ where: { id }, data: { revokedAt: new Date(), revokedById: adminId } });
  if (s.kind === "ACCOUNT_SUSPENSION") await syncSuspension(s.userId);
  invalidateIpCache();
  return row;
}

/** Remembers the client's IP on the user (login / upload) so admins can block it later. */
export async function rememberIp(userId: string, ip: string | null | undefined) {
  if (!isAttributableIp(ip)) return;
  await prisma.user.update({ where: { id: userId }, data: { lastIp: ip } }).catch(() => undefined);
}

export function isSanctionActive(s: { revokedAt: Date | null; endsAt: Date | null; startsAt: Date }, now = new Date()) {
  return !s.revokedAt && s.startsAt <= now && (s.endsAt === null || s.endsAt > now);
}
