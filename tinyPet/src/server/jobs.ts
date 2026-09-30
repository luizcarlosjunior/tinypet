import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/db";
import { Errors } from "./errors";
import { handler, ok } from "./api";
import { notify, notifyPartner } from "./notify";
import { awardBadge } from "./badges";
import { cleanupPendingUploads } from "./media-audit";
import { allDueDone, allDueResolved, dateOnly, shiftDays, todaySP, weightAlertSetting, weightAlerts, ymd } from "./pets";

const WEAK_CRON_SECRETS = new Set(["change-me-cron", "dev-cron-secret"]);

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/**
 * Jobs are protected by CRON_SECRET, sent as `Authorization: Bearer <CRON_SECRET>` (server crontab, see docs/deploy.md)
 * or `x-cron-secret: <CRON_SECRET>`. Rejects when the secret is unset and, in production, when it is shorter than
 * 16 chars or a placeholder (`change-me-cron`, `dev-cron-secret`).
 */
export function requireCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const weak = process.env.NODE_ENV === "production" && (secret.length < 16 || WEAK_CRON_SECRETS.has(secret));
  if (!secret || weak) {
    if (secret && weak) console.warn("[cron] CRON_SECRET is too weak; refusing job requests");
    throw Errors.unauthorized("Cron secret inválido");
  }
  const auth = req.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : (req.headers.get("x-cron-secret") ?? "");
  if (!provided || !safeEqual(provided, secret)) throw Errors.unauthorized("Cron secret inválido");
}

/** Builds `{ GET, POST }` route exports for a cron job (callable with either method). */
export function cronRoute(job: () => Promise<unknown>) {
  const h = handler(async (req) => {
    requireCron(req);
    return ok(await job());
  });
  return { GET: h, POST: h };
}

/** PENDING installments past due → OVERDUE. */
export async function jobOverdue() {
  const today = dateOnly(todaySP());
  const r = await prisma.installment.updateMany({ where: { status: "PENDING", dueDate: { lt: today } }, data: { status: "OVERDUE" } });
  return { updated: r.count };
}

/** Weight variation above settings.weight_alert within the window → notify owner and linked vet clinics (once per window). */
export async function jobWeightAlerts() {
  const { days } = await weightAlertSetting();
  const since = new Date(Date.now() - days * 86_400_000);
  const pets = await prisma.pet.findMany({
    where: { deletedAt: null, status: "ACTIVE", measurements: { some: { measuredAt: { gte: since } } } },
    select: {
      id: true,
      name: true,
      ownerId: true,
      measurements: { where: { measuredAt: { gte: since } }, select: { measuredAt: true, weightG: true } },
      clients: { select: { client: { select: { partnerId: true, partner: { select: { types: { select: { type: { select: { key: true } } } } } } } } } },
    },
  });
  const recent = await prisma.notification.findMany({ where: { type: "weight_alert", createdAt: { gte: since } }, select: { data: true } });
  const alreadyNotified = new Set(recent.map((n) => (n.data as { petId?: string } | null)?.petId).filter(Boolean));
  let notified = 0;
  for (const pet of pets) {
    if (alreadyNotified.has(pet.id)) continue;
    const [alert] = await weightAlerts(pet.measurements);
    if (!alert) continue;
    const body = `${pet.name} ${alert.direction === "gain" ? "ganhou" : "perdeu"} ${Math.abs(alert.pct)}% de peso em ${alert.days} dias (${(alert.fromWeightG / 1000).toFixed(2)} → ${(alert.toWeightG / 1000).toFixed(2)} kg).`;
    const data = { petId: pet.id, ...alert };
    if (pet.ownerId) await notify({ userId: pet.ownerId, type: "weight_alert", title: `Alerta de peso: ${pet.name}`, body, data, email: true });
    const vetPartnerIds = Array.from(new Set(pet.clients.filter((c) => c.client.partner.types.some((t) => t.type.key === "vet_clinic")).map((c) => c.client.partnerId)));
    for (const partnerId of vetPartnerIds) await notifyPartner(partnerId, { type: "weight_alert", title: `Alerta de peso: ${pet.name}`, body, data });
    notified++;
  }
  return { checked: pets.length, notified };
}

/** Resets streaks of pets that missed a due task yesterday (a task skipped with a reason doesn't count as missed); awards "vaccines_up_to_date". */
export async function jobStreaks() {
  const today = todaySP();
  const yesterday = shiftDays(today, -1);
  const streaking = await prisma.pet.findMany({ where: { deletedAt: null, status: "ACTIVE", streakDays: { gt: 0 } }, select: { id: true } });
  let reset = 0;
  for (const p of streaking) {
    if (!(await allDueResolved(p.id, yesterday))) {
      await prisma.pet.update({ where: { id: p.id }, data: { streakDays: 0 } });
      reset++;
    }
  }

  // vaccines_up_to_date: ≥1 vaccination, first one at least 180 days ago, and no kind+name whose latest dose is past its nextDueAt.
  const cutoff = dateOnly(shiftDays(today, -180));
  const badge = await prisma.badge.findUnique({ where: { key: "vaccines_up_to_date" } });
  const candidates = await prisma.pet.findMany({
    where: { deletedAt: null, status: "ACTIVE", vaccinations: { some: { appliedAt: { lte: cutoff } } }, ...(badge ? { earnedBadges: { none: { badgeId: badge.id } } } : {}) },
    select: { id: true, vaccinations: { select: { kind: true, name: true, appliedAt: true, nextDueAt: true }, orderBy: { appliedAt: "desc" } } },
  });
  const todayDate = dateOnly(today);
  let awarded = 0;
  for (const p of candidates) {
    const latestByName = new Map<string, (typeof p.vaccinations)[number]>();
    for (const v of p.vaccinations) {
      const k = `${v.kind}|${v.name.toLowerCase()}`;
      if (!latestByName.has(k)) latestByName.set(k, v);
    }
    const overdue = Array.from(latestByName.values()).some((v) => v.nextDueAt && v.nextDueAt < todayDate);
    if (!overdue && (await awardBadge(p.id, "vaccines_up_to_date"))) awarded++;
  }
  return { checked: streaking.length, reset, vaccineBadgesAwarded: awarded };
}

/** Soft-deletes stories past their 24h expiry. */
export async function jobStoriesCleanup() {
  const r = await prisma.petMedia.updateMany({ where: { isStory: true, deletedAt: null, expiresAt: { lt: new Date() } }, data: { deletedAt: new Date() } });
  const pendingUploads = await cleanupPendingUploads();
  return { deleted: r.count, pendingUploads };
}

/** Vaccines/dewormers due in the next 7 days → notify the owner (once per dose). */
export async function jobVaccineReminders() {
  const today = todaySP();
  const from = dateOnly(today);
  const to = dateOnly(shiftDays(today, 7));
  const due = await prisma.vaccination.findMany({
    where: { nextDueAt: { gte: from, lte: to }, pet: { deletedAt: null, status: "ACTIVE", ownerId: { not: null } } },
    include: { pet: { select: { id: true, name: true, ownerId: true } } },
  });
  const recent = await prisma.notification.findMany({ where: { type: "vaccine_reminder", createdAt: { gte: new Date(Date.now() - 8 * 86_400_000) } }, select: { data: true } });
  const sent = new Set(recent.map((n) => (n.data as { vaccinationId?: string } | null)?.vaccinationId).filter(Boolean));
  let notified = 0;
  for (const v of due) {
    if (sent.has(v.id) || !v.pet.ownerId) continue;
    const when = ymd(v.nextDueAt!).split("-").reverse().join("/");
    await notify({
      userId: v.pet.ownerId,
      type: "vaccine_reminder",
      title: `${v.kind === "VACCINE" ? "Vacina" : "Vermífugo"} de ${v.pet.name} vence em ${when}`,
      body: `${v.name} — próxima dose em ${when}.`,
      data: { petId: v.pet.id, vaccinationId: v.id, nextDueAt: ymd(v.nextDueAt!) },
      email: true,
    });
    notified++;
  }
  return { due: due.length, notified };
}
