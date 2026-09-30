import { prisma, Prisma, type MediaAsset } from "@/db";
import { MEDIA_REPORT_REASONS, type mediaAuditDecisionSchema, type mediaReportSchema } from "@tinypet/shared";
import type { z } from "zod";
import { Errors } from "./errors";
import { rateLimit } from "./api";
import { deleteBytes } from "./media";
import { notify } from "./notify";
import { audit } from "./audit";
import { assertCanReport, createSanction, isAttributableIp, isSanctionActive } from "./sanctions";

const REASON_LABEL = Object.fromEntries(MEDIA_REPORT_REASONS.map((r) => [r.key, r.label])) as Record<string, string>;

// ───────────────────────────── report (users) ─────────────────────────────

/** Finds the asset behind a URL shown on screen (the media itself or its thumbnail/cover). */
async function assetByUrl(url: string) {
  const asset = await prisma.mediaAsset.findFirst({ where: { OR: [{ url }, { thumbUrl: url }], purpose: { not: "VIDEO_COVER" } } });
  if (asset) return asset;
  // A video cover URL points to the VIDEO_COVER asset; report the video that uses it.
  const cover = await prisma.mediaAsset.findFirst({ where: { OR: [{ url }, { thumbUrl: url }] } });
  if (cover?.purpose === "VIDEO_COVER") return (await prisma.mediaAsset.findFirst({ where: { kind: "VIDEO", thumbUrl: cover.url } })) ?? cover;
  return cover;
}

/** POST /media/report: a user reports a photo/video that breaks the community rules. */
export async function reportMedia(userId: string, input: z.infer<typeof mediaReportSchema>, ip: string) {
  await assertCanReport(userId);
  await rateLimit(`media-report:${userId}`, 20, 3_600_000);
  const asset = await assetByUrl(input.url);
  if (!asset || asset.status === "REJECTED") throw Errors.notFound("Mídia não encontrada");
  if (asset.userId === userId || asset.uploadedByUserId === userId) throw Errors.badRequest("Você não pode denunciar uma mídia que você enviou");
  if (asset.partnerId && (await prisma.membership.findUnique({ where: { userId_partnerId: { userId, partnerId: asset.partnerId } } }))) {
    throw Errors.badRequest("Você não pode denunciar uma mídia do seu próprio negócio");
  }
  const existing = await prisma.mediaReport.findUnique({ where: { mediaAssetId_reporterId: { mediaAssetId: asset.id, reporterId: userId } } });
  if (existing) throw Errors.conflict("Você já denunciou esta mídia. Ela está em análise.");
  const report = await prisma.mediaReport.create({
    data: { mediaAssetId: asset.id, reporterId: userId, reason: input.reason, details: input.details || null, reporterIp: isAttributableIp(ip) ? ip : null },
    select: { id: true, createdAt: true },
  });
  return { ...report, received: true };
}

// ───────────────────────────── where a media is used ─────────────────────────────

export type MediaUsage = { type: "PET_MEDIA" | "PET_AVATAR" | "USER_AVATAR" | "PARTNER_LOGO" | "VENUE_PHOTO" | "CATALOG" | "COURSE_COVER" | "LESSON_VIDEO" | "LESSON_ATTACHMENT" | "PET_HISTORY" | "APPOINTMENT_REPORT" | "PRODUCT_IMAGE"; id: string; label: string; href?: string };

/** URLs that point to this asset's bytes (the file, its thumbnail and, for videos, the cover asset). */
async function relatedUrls(asset: MediaAsset) {
  const cover = asset.kind === "VIDEO" && asset.thumbUrl ? await prisma.mediaAsset.findFirst({ where: { url: asset.thumbUrl, purpose: "VIDEO_COVER" } }) : null;
  const urls = [asset.url, asset.thumbUrl, cover?.url, cover?.thumbUrl].filter((u): u is string => !!u);
  return { urls: [...new Set(urls)], cover };
}

const jsonHas = (column: "attachments" | "report_photos", table: "pet_history_events" | "appointments", urls: string[]) =>
  prisma.$queryRaw<{ id: string }[]>`SELECT id FROM ${Prisma.raw(table)} WHERE ${Prisma.join(urls.map((u) => Prisma.sql`CAST(${Prisma.raw(column)} AS CHAR) LIKE ${`%${u}%`}`), " OR ")}`;

export async function mediaUsages(asset: MediaAsset): Promise<MediaUsage[]> {
  const { urls } = await relatedUrls(asset);
  const inUrls = { in: urls };
  const [petMedia, pets, users, partners, venue, catalog, courses, lessons, attachments, history, appts, lines, flavors] = await Promise.all([
    prisma.petMedia.findMany({ where: { OR: [{ url: inUrls }, { thumbUrl: inUrls }] }, select: { id: true, petId: true, isStory: true, pet: { select: { name: true } } } }),
    prisma.pet.findMany({ where: { avatarUrl: inUrls }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { avatarUrl: inUrls }, select: { id: true, name: true } }),
    prisma.partner.findMany({ where: { logoUrl: inUrls }, select: { id: true, tradeName: true, slug: true } }),
    prisma.venuePhoto.findMany({ where: { OR: [{ url: inUrls }, { thumbUrl: inUrls }] }, select: { id: true, partner: { select: { tradeName: true, slug: true } } } }),
    prisma.catalogItemMedia.findMany({ where: { OR: [{ url: inUrls }, { thumbUrl: inUrls }] }, select: { id: true, item: { select: { id: true, name: true, partner: { select: { slug: true } } } } } }),
    prisma.course.findMany({ where: { coverUrl: inUrls }, select: { id: true, title: true } }),
    prisma.lesson.findMany({ where: { videoUrl: inUrls }, select: { id: true, title: true } }),
    prisma.lessonAttachment.findMany({ where: { url: inUrls }, select: { id: true, name: true } }),
    jsonHas("attachments", "pet_history_events", urls),
    jsonHas("report_photos", "appointments", urls),
    prisma.productLine.findMany({ where: { imageUrl: inUrls }, select: { id: true, name: true } }),
    prisma.productFlavor.findMany({ where: { imageUrl: inUrls }, select: { id: true, name: true } }),
  ]);
  return [
    ...petMedia.map((m) => ({ type: "PET_MEDIA" as const, id: m.id, label: `${m.isStory ? "Story" : "Galeria"} de ${m.pet.name}` })),
    ...pets.map((p) => ({ type: "PET_AVATAR" as const, id: p.id, label: `Foto de perfil do pet ${p.name}` })),
    ...users.map((u) => ({ type: "USER_AVATAR" as const, id: u.id, label: `Foto de perfil de ${u.name}` })),
    ...partners.map((p) => ({ type: "PARTNER_LOGO" as const, id: p.id, label: `Logo de ${p.tradeName}`, href: `/p/${p.slug}` })),
    ...venue.map((v) => ({ type: "VENUE_PHOTO" as const, id: v.id, label: `Foto do local · ${v.partner.tradeName}`, href: `/p/${v.partner.slug}` })),
    ...catalog.map((c) => ({ type: "CATALOG" as const, id: c.id, label: `Catálogo · ${c.item.name}`, href: `/p/${c.item.partner.slug}/item/${c.item.id}` })),
    ...courses.map((c) => ({ type: "COURSE_COVER" as const, id: c.id, label: `Capa do curso ${c.title}` })),
    ...lessons.map((l) => ({ type: "LESSON_VIDEO" as const, id: l.id, label: `Vídeo da aula ${l.title}` })),
    ...attachments.map((a) => ({ type: "LESSON_ATTACHMENT" as const, id: a.id, label: `Anexo ${a.name}` })),
    ...history.map((h) => ({ type: "PET_HISTORY" as const, id: h.id, label: "Anexo no histórico de um pet" })),
    ...appts.map((a) => ({ type: "APPOINTMENT_REPORT" as const, id: a.id, label: "Foto no relatório de um atendimento" })),
    ...lines.map((l) => ({ type: "PRODUCT_IMAGE" as const, id: l.id, label: `Imagem da linha ${l.name}` })),
    ...flavors.map((f) => ({ type: "PRODUCT_IMAGE" as const, id: f.id, label: `Imagem do sabor ${f.name}` })),
  ];
}

/** Removes a URL from a JSON array column value (`[{url}]` or `[url]`). */
function withoutUrls(value: Prisma.JsonValue, urls: string[]): Prisma.InputJsonValue {
  if (!Array.isArray(value)) return (value ?? []) as Prisma.InputJsonValue;
  return value.filter((x) => {
    const u = typeof x === "string" ? x : x && typeof x === "object" && !Array.isArray(x) ? (x as { url?: unknown }).url : null;
    return !(typeof u === "string" && urls.includes(u));
  }) as Prisma.InputJsonValue;
}

/**
 * Real deletion: removes the bytes from storage (file, thumbnail, video cover) and every reference to them
 * (gallery items hard-deleted, avatars/logo/covers cleared, catalog/venue/lesson rows removed, JSON attachments pruned),
 * then deletes the MediaAsset rows. Reports keep a snapshot.
 */
export async function purgeMedia(asset: MediaAsset) {
  const { urls, cover } = await relatedUrls(asset);
  const inUrls = { in: urls };
  const usages = await mediaUsages(asset);
  const historyIds = usages.filter((u) => u.type === "PET_HISTORY").map((u) => u.id);
  const apptIds = usages.filter((u) => u.type === "APPOINTMENT_REPORT").map((u) => u.id);
  const [historyRows, apptRows] = await Promise.all([
    historyIds.length ? prisma.petHistoryEvent.findMany({ where: { id: { in: historyIds } }, select: { id: true, attachments: true } }) : [],
    apptIds.length ? prisma.appointment.findMany({ where: { id: { in: apptIds } }, select: { id: true, reportPhotos: true } }) : [],
  ]);
  const snapshot = { kind: asset.kind, purpose: asset.purpose, url: asset.url, thumbUrl: asset.thumbUrl, uploaderUserId: asset.uploadedByUserId ?? asset.userId, uploaderPartnerId: asset.partnerId, uploadIp: asset.uploadIp, createdAt: asset.createdAt.toISOString() };
  const assetIds = [asset.id, ...(cover ? [cover.id] : [])];

  await prisma.$transaction([
    prisma.mediaReport.updateMany({ where: { mediaAssetId: { in: assetIds } }, data: { snapshot } }),
    prisma.petMedia.deleteMany({ where: { OR: [{ url: inUrls }, { thumbUrl: inUrls }] } }),
    prisma.pet.updateMany({ where: { avatarUrl: inUrls }, data: { avatarUrl: null } }),
    prisma.user.updateMany({ where: { avatarUrl: inUrls }, data: { avatarUrl: null } }),
    prisma.partner.updateMany({ where: { logoUrl: inUrls }, data: { logoUrl: null } }),
    prisma.venuePhoto.deleteMany({ where: { OR: [{ url: inUrls }, { thumbUrl: inUrls }] } }),
    prisma.catalogItemMedia.deleteMany({ where: { OR: [{ url: inUrls }, { thumbUrl: inUrls }] } }),
    prisma.course.updateMany({ where: { coverUrl: inUrls }, data: { coverUrl: null } }),
    prisma.lesson.updateMany({ where: { videoUrl: inUrls }, data: { videoUrl: null } }),
    prisma.lessonAttachment.deleteMany({ where: { url: inUrls } }),
    prisma.productLine.updateMany({ where: { imageUrl: inUrls }, data: { imageUrl: null } }),
    prisma.productFlavor.updateMany({ where: { imageUrl: inUrls }, data: { imageUrl: null } }),
    ...historyRows.map((h) => prisma.petHistoryEvent.update({ where: { id: h.id }, data: { attachments: withoutUrls(h.attachments, urls) } })),
    ...apptRows.map((a) => prisma.appointment.update({ where: { id: a.id }, data: { reportPhotos: withoutUrls(a.reportPhotos, urls) } })),
    prisma.mediaAsset.deleteMany({ where: { id: { in: assetIds } } }),
  ]);

  // Storage last: if it fails the DB no longer points to the object (logged, the object is orphaned, never visible).
  const keys = [asset.key, cover?.key].filter((k): k is string => !!k);
  for (const k of keys) {
    await deleteBytes(k);
    if (k.endsWith(".webp")) await deleteBytes(k.replace(/\.webp$/, ".thumb.webp"));
  }
  return { usages, deletedAssets: assetIds.length };
}

/**
 * After a user removes an item (e.g. a gallery photo), deletes the stored file when nothing else uses it anymore,
 * so a removed photo's public URL stops working. `ignorePetMediaIds`: soft-deleted rows that no longer count as usage.
 */
export async function releaseMediaIfUnused(url: string, ignorePetMediaIds: string[] = []) {
  const asset = await prisma.mediaAsset.findFirst({ where: { OR: [{ url }, { thumbUrl: url }], purpose: { not: "VIDEO_COVER" } } });
  if (!asset) return false;
  const ignore = new Set(ignorePetMediaIds);
  const deletedRows = await prisma.petMedia.findMany({ where: { deletedAt: { not: null }, OR: [{ url: asset.url }, ...(asset.thumbUrl ? [{ thumbUrl: asset.thumbUrl }] : [])] }, select: { id: true } });
  for (const r of deletedRows) ignore.add(r.id);
  const usages = (await mediaUsages(asset)).filter((u) => !(u.type === "PET_MEDIA" && ignore.has(u.id)));
  if (usages.length) return false;
  if (await prisma.mediaReport.count({ where: { mediaAssetId: asset.id, status: "OPEN" } })) return false; // keep evidence for the audit queue
  await purgeMedia(asset);
  return true;
}

/** Uploads never completed (PENDING after 24 h): delete the bytes (if any were PUT) and the row. */
export async function cleanupPendingUploads() {
  const stale = await prisma.mediaAsset.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 86_400_000) } }, select: { id: true, key: true }, take: 500 });
  for (const a of stale) {
    await deleteBytes(a.key).catch(() => undefined);
    await prisma.mediaAsset.delete({ where: { id: a.id } }).catch(() => undefined);
  }
  return stale.length;
}

// ───────────────────────────── admin queue ─────────────────────────────

const userCard = { id: true, name: true, email: true, username: true, lastIp: true, suspendedUntil: true } as const;

/** Assets with reports in `status`, most reported first (OPEN) or most recent (history). */
export async function auditQueue(status: "OPEN" | "RESOLVED" | "DISMISSED", page: number, pageSize: number) {
  const groups = await prisma.mediaReport.groupBy({
    by: ["mediaAssetId"],
    where: { status, mediaAssetId: { not: null } },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: status === "OPEN" ? [{ _count: { mediaAssetId: "desc" } }, { _max: { createdAt: "desc" } }] : [{ _max: { createdAt: "desc" } }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const totalRows = await prisma.mediaReport.groupBy({ by: ["mediaAssetId"], where: { status, mediaAssetId: { not: null } } });
  const ids = groups.map((g) => g.mediaAssetId!);
  const [assets, reasons] = await Promise.all([
    prisma.mediaAsset.findMany({ where: { id: { in: ids } }, include: { user: { select: userCard }, partner: { select: { id: true, tradeName: true, slug: true } } } }),
    prisma.mediaReport.groupBy({ by: ["mediaAssetId", "reason"], where: { status, mediaAssetId: { in: ids } }, _count: { _all: true } }),
  ]);
  const byId = new Map(assets.map((a) => [a.id, a]));
  const uploaderIds = [...new Set(assets.map((a) => a.uploadedByUserId).filter((x): x is string => !!x))];
  const uploaders = new Map((await prisma.user.findMany({ where: { id: { in: uploaderIds } }, select: userCard })).map((u) => [u.id, u]));
  const items = groups
    .map((g) => {
      const a = byId.get(g.mediaAssetId!);
      if (!a) return null;
      return {
        asset: { id: a.id, url: a.url, thumbUrl: a.thumbUrl, kind: a.kind, purpose: a.purpose, status: a.status, createdAt: a.createdAt, uploadIp: a.uploadIp },
        uploader: (a.uploadedByUserId ? uploaders.get(a.uploadedByUserId) : null) ?? a.user,
        partner: a.partner,
        reportsCount: g._count._all,
        lastReportAt: g._max.createdAt,
        reasons: reasons.filter((r) => r.mediaAssetId === a.id).map((r) => ({ reason: r.reason, label: REASON_LABEL[r.reason] ?? r.reason, count: r._count._all })),
      };
    })
    .filter(Boolean);
  return { items, total: totalRows.length };
}

/** Reporter track record, to judge false reports. */
async function reporterStats(ids: string[]) {
  const rows = await prisma.mediaReport.groupBy({ by: ["reporterId", "status"], where: { reporterId: { in: ids } }, _count: { _all: true } });
  const out: Record<string, { total: number; resolved: number; dismissed: number }> = {};
  for (const r of rows) {
    const s = (out[r.reporterId] ??= { total: 0, resolved: 0, dismissed: 0 });
    s.total += r._count._all;
    if (r.status === "RESOLVED") s.resolved += r._count._all;
    if (r.status === "DISMISSED") s.dismissed += r._count._all;
  }
  return out;
}

const sanctionSelect = { id: true, kind: true, ip: true, reason: true, startsAt: true, endsAt: true, revokedAt: true, createdAt: true, mediaAssetId: true } as const;

export async function auditDetail(assetId: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId }, include: { user: { select: userCard }, partner: { select: { id: true, tradeName: true, slug: true } } } });
  if (!asset) throw Errors.notFound("Mídia não encontrada (pode já ter sido excluída)");
  const reports = await prisma.mediaReport.findMany({ where: { mediaAssetId: assetId }, orderBy: { createdAt: "desc" }, include: { reporter: { select: userCard }, resolvedBy: { select: { id: true, name: true } } } });
  const reporterIds = [...new Set(reports.map((r) => r.reporterId))];
  const uploaderId = asset.uploadedByUserId ?? asset.userId;
  const uploaderUser = uploaderId ? await prisma.user.findUnique({ where: { id: uploaderId }, select: userCard }) : null;
  const people = [...reporterIds, ...(uploaderId ? [uploaderId] : [])];
  const [usages, stats, sanctions] = await Promise.all([
    mediaUsages(asset),
    reporterStats(reporterIds),
    prisma.userSanction.findMany({ where: { userId: { in: people } }, orderBy: { createdAt: "desc" }, select: { ...sanctionSelect, userId: true } }),
  ]);
  const withActive = (userId: string) => sanctions.filter((s) => s.userId === userId).map((s) => ({ ...s, active: isSanctionActive(s) }));
  return {
    asset: { id: asset.id, url: asset.url, thumbUrl: asset.thumbUrl, kind: asset.kind, purpose: asset.purpose, status: asset.status, mimeType: asset.mimeType, width: asset.width, height: asset.height, sizeBytes: asset.sizeBytes, createdAt: asset.createdAt, uploadIp: asset.uploadIp },
    uploader: uploaderUser ? { ...uploaderUser, sanctions: withActive(uploaderUser.id) } : null,
    partner: asset.partner,
    usages,
    reports: reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      reasonLabel: REASON_LABEL[r.reason] ?? r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      resolvedBy: r.resolvedBy,
      reporterIp: r.reporterIp,
      reporter: { ...r.reporter, stats: stats[r.reporterId] ?? { total: 0, resolved: 0, dismissed: 0 }, sanctions: withActive(r.reporterId) },
    })),
  };
}

// ───────────────────────────── admin decision ─────────────────────────────

type Decision = z.infer<typeof mediaAuditDecisionSchema>;

const durationLabel = (d: 7 | 15 | 30 | "PERMANENT") => (d === "PERMANENT" ? "permanente" : `${d} dias`);

export async function decideAudit(assetId: string, d: Decision, adminId: string, ip: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.notFound("Mídia não encontrada (pode já ter sido excluída)");
  const open = await prisma.mediaReport.findMany({ where: { mediaAssetId: assetId, status: "OPEN" }, select: { id: true, reporterId: true } });
  const sanctions: { userId: string; kind: string; endsAt: Date | null }[] = [];

  if (d.action === "DELETE") {
    // Resolve the reports before the purge (it keeps their snapshot and nulls the asset link).
    await prisma.mediaReport.updateMany({ where: { mediaAssetId: assetId, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: adminId } });
    const uploaderId = asset.uploadedByUserId ?? asset.userId;
    if (d.uploader && uploaderId) {
      if (d.uploader.blockIp) {
        const target = asset.uploadIp ?? (await prisma.user.findUnique({ where: { id: uploaderId }, select: { lastIp: true } }))?.lastIp ?? null;
        const s = await createSanction({ userId: uploaderId, kind: "IP_BLOCK", duration: 7, ip: target, reason: d.reason, createdById: adminId, mediaAssetId: assetId });
        sanctions.push({ userId: uploaderId, kind: s.kind, endsAt: s.endsAt });
      }
      if (d.uploader.account) {
        const s = await createSanction({ userId: uploaderId, kind: "ACCOUNT_SUSPENSION", duration: d.uploader.account, reason: d.reason, createdById: adminId, mediaAssetId: assetId });
        sanctions.push({ userId: uploaderId, kind: s.kind, endsAt: s.endsAt });
      }
    } else if (d.uploader && (d.uploader.blockIp || d.uploader.account)) {
      throw Errors.badRequest("Não há usuário associado a esta mídia para aplicar sanção");
    }
    const purge = await purgeMedia(asset);
    if (uploaderId) {
      const extra = d.uploader?.account ? ` Sua conta foi suspensa (${durationLabel(d.uploader.account)}).` : "";
      await notify({ userId: uploaderId, type: "media_removed", title: "Uma mídia sua foi removida", body: `Removemos ${asset.kind === "VIDEO" ? "um vídeo enviado" : "uma foto enviada"} por você por violar as regras da comunidade. Motivo: ${d.reason}.${extra}`, data: { route: "/regras-da-comunidade" }, email: true }).catch(() => undefined);
    }
    await audit({ userId: adminId, action: "media.audit_delete", entity: "MediaAsset", entityId: assetId, data: { reason: d.reason, reports: open.length, usages: purge.usages.length, sanctions }, ip });
    return { action: "DELETE", reportsResolved: open.length, usagesRemoved: purge.usages.length, sanctions };
  }

  // DISMISS: media stays; false reporters may be sanctioned.
  const reporterIds = new Set(open.map((r) => r.reporterId));
  for (const r of d.reporters) if (!reporterIds.has(r.userId)) throw Errors.badRequest("Só é possível punir quem tem denúncia aberta nesta mídia");
  await prisma.mediaReport.updateMany({ where: { mediaAssetId: assetId, status: "OPEN" }, data: { status: "DISMISSED", resolvedAt: new Date(), resolvedById: adminId } });
  if (asset.status === "FLAGGED") await prisma.mediaAsset.update({ where: { id: assetId }, data: { status: "READY" } });
  for (const r of d.reporters) {
    const reportId = open.find((o) => o.reporterId === r.userId)?.id;
    const s = await createSanction({ userId: r.userId, kind: r.type === "ACCOUNT" ? "ACCOUNT_SUSPENSION" : "REPORT_BAN", duration: r.duration, reason: d.reason, createdById: adminId, mediaAssetId: assetId, mediaReportId: reportId });
    sanctions.push({ userId: r.userId, kind: s.kind, endsAt: s.endsAt });
    await notify({
      userId: r.userId,
      type: "report_sanction",
      title: r.type === "ACCOUNT" ? "Sua conta foi suspensa" : "Denúncias bloqueadas",
      body: `${r.type === "ACCOUNT" ? "Sua conta foi suspensa" : "Você não poderá fazer novas denúncias"} (${durationLabel(r.duration)}) por denúncia que não procedia. Motivo: ${d.reason}.`,
      data: { route: "/regras-da-comunidade" },
      email: true,
    }).catch(() => undefined);
  }
  await audit({ userId: adminId, action: "media.audit_dismiss", entity: "MediaAsset", entityId: assetId, data: { reason: d.reason, reports: open.length, sanctions }, ip });
  return { action: "DISMISS", reportsDismissed: open.length, sanctions };
}

// ───────────────────────────── sanctions list ─────────────────────────────

export async function listSanctions(opts: { active?: boolean; userId?: string; page: number; pageSize: number }) {
  const now = new Date();
  const where: Prisma.UserSanctionWhereInput = {
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.active ? { revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.userSanction.count({ where }),
    prisma.userSanction.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize, select: { ...sanctionSelect, user: { select: { id: true, name: true, email: true, username: true } }, createdBy: { select: { id: true, name: true } }, revokedBy: { select: { id: true, name: true } } } }),
  ]);
  return { items: rows.map((s) => ({ ...s, active: isSanctionActive(s, now) })), total };
}
