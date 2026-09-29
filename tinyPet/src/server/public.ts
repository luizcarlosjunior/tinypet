import { prisma, Prisma } from "@/db";
import { haversineKm } from "@tinypet/shared";
import type { PartnerSearchQuery } from "@tinypet/shared";
import { Errors } from "./errors";
import { catalogInclude } from "./catalog";

const publicReviewInclude = { user: { select: { id: true, name: true, avatarUrl: true } }, reply: true, item: { select: { id: true, name: true } } } satisfies Prisma.ReviewInclude;

// ───────────────────────────── partners ─────────────────────────────

/**
 * Public search. Text/type/rating/city filters go to the DB; category, species, distance and radius
 * are resolved in memory (JSON columns + haversine). Ordered featured → rating → distance.
 */
export async function searchPartners(q: PartnerSearchQuery) {
  const where: Prisma.PartnerWhereInput = {
    published: true,
    deletedAt: null,
    ...(q.q ? { OR: [{ tradeName: { contains: q.q } }, { description: { contains: q.q } }, { catalogItems: { some: { deletedAt: null, status: "PUBLISHED", name: { contains: q.q } } } }] } : {}),
    ...(q.type ? { types: { some: { type: { key: q.type } } } } : {}),
    ...(q.minRating != null ? { ratingAvg: { gte: q.minRating } } : {}),
    ...(q.city || q.state ? { addresses: { some: { isPrimary: true, ...(q.city ? { city: { contains: q.city } } : {}), ...(q.state ? { state: q.state.toUpperCase() } : {}) } } } : {}),
  };
  const partners = await prisma.partner.findMany({
    where,
    include: {
      types: { include: { type: { select: { key: true, label: true } } } },
      addresses: { where: { isPrimary: true }, take: 1 },
      catalogItems: { where: { deletedAt: null, status: "PUBLISHED" }, select: { speciesKeys: true, category: { select: { key: true, label: true } } } },
    },
  });

  const hasOrigin = q.lat != null && q.lng != null;
  const rows = partners
    .map((p) => {
      const addr = p.addresses[0];
      const lat = addr?.latitude != null ? Number(addr.latitude) : null;
      const lng = addr?.longitude != null ? Number(addr.longitude) : null;
      const distanceKm = hasOrigin && lat != null && lng != null ? Math.round(haversineKm(q.lat!, q.lng!, lat, lng) * 10) / 10 : undefined;
      const categoriesMap = new Map<string, string>();
      const species = new Set<string>();
      for (const it of p.catalogItems) {
        categoriesMap.set(it.category.key, it.category.label);
        for (const s of (it.speciesKeys as string[] | null) ?? []) species.add(s);
      }
      return {
        id: p.id,
        slug: p.slug,
        tradeName: p.tradeName,
        logoUrl: p.logoUrl,
        description: p.description,
        types: p.types.map((t) => t.type),
        ratingAvg: p.ratingAvg != null ? Number(p.ratingAvg) : null,
        ratingCount: p.ratingCount,
        city: addr?.city ?? null,
        state: addr?.state ?? null,
        lat,
        lng,
        distanceKm,
        featured: p.featured,
        serviceRadiusKm: p.serviceRadiusKm,
        categories: Array.from(categoriesMap, ([key, label]) => ({ key, label })),
        species: Array.from(species),
      };
    })
    .filter((r) => {
      if (q.category && !r.categories.some((c) => c.key === q.category)) return false;
      if (q.species && !r.species.includes(q.species)) return false;
      if (hasOrigin && q.radiusKm != null) {
        if (r.distanceKm == null) return false;
        // Within the searched radius, or the partner travels to the searcher (service radius).
        return r.distanceKm <= Math.max(q.radiusKm, r.serviceRadiusKm ?? 0);
      }
      return true;
    })
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      const ra = a.ratingAvg ?? 0;
      const rb = b.ratingAvg ?? 0;
      if (ra !== rb) return rb - ra;
      if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      if (a.distanceKm != null && b.distanceKm == null) return -1;
      if (a.distanceKm == null && b.distanceKm != null) return 1;
      return a.tradeName.localeCompare(b.tradeName);
    });

  const total = rows.length;
  const start = (q.page - 1) * q.pageSize;
  return { items: rows.slice(start, start + q.pageSize).map(({ species: _s, ...r }) => r), total };
}

export async function getPublicPartner(slug: string) {
  const p = await prisma.partner.findFirst({
    where: { slug, published: true, deletedAt: null },
    include: {
      types: { include: { type: { select: { key: true, label: true } } } },
      socialLinks: true,
      businessHours: { orderBy: { weekday: "asc" } },
      venuePhotos: { orderBy: { sortOrder: "asc" } },
      addresses: { where: { isPrimary: true }, take: 1 },
      phones: { where: { isPrimary: true }, select: { type: true, number: true }, take: 1 },
      catalogItems: { where: { deletedAt: null, status: "PUBLISHED" }, include: catalogInclude, orderBy: [{ type: "asc" }, { name: "asc" }] },
      reviews: { where: { status: "VISIBLE" }, include: publicReviewInclude, orderBy: { createdAt: "desc" }, take: 50 },
      courses: { where: { status: "PUBLISHED" }, select: { id: true, title: true, coverUrl: true, level: true, price: true, ratingAvg: true, ratingCount: true } },
    },
  });
  if (!p) throw Errors.notFound("Parceiro não encontrado");
  const { document: _doc, documentType: _dt, legalName: _ln, plan: _plan, ...rest } = p;
  return { ...rest, types: p.types.map((t) => t.type), address: p.addresses[0] ?? null, phone: p.phones[0] ?? null };
}

export async function getPublicItem(id: string) {
  const item = await prisma.catalogItem.findFirst({
    where: { id, deletedAt: null, status: "PUBLISHED", partner: { published: true, deletedAt: null } },
    include: {
      ...catalogInclude,
      partner: { select: { id: true, slug: true, tradeName: true, logoUrl: true, ratingAvg: true, ratingCount: true, serviceRadiusKm: true, cancellationHours: true, addresses: { where: { isPrimary: true }, take: 1 } } },
      reviews: { where: { status: "VISIBLE" }, include: publicReviewInclude, orderBy: { createdAt: "desc" } },
    },
  });
  if (!item) throw Errors.notFound("Item não encontrado");
  return { ...item, partner: { ...item.partner, address: item.partner.addresses[0] ?? null, addresses: undefined } };
}

// ───────────────────────────── courses ─────────────────────────────

export type PublicCourseQuery = { page: number; pageSize: number; q?: string; category?: string; species?: string; level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"; free?: boolean; partner?: string };

export async function listPublicCourses(q: PublicCourseQuery) {
  const where: Prisma.CourseWhereInput = {
    status: "PUBLISHED",
    partner: { published: true, deletedAt: null },
    ...(q.q ? { OR: [{ title: { contains: q.q } }, { description: { contains: q.q } }] } : {}),
    ...(q.category ? { category: { key: q.category } } : {}),
    ...(q.level ? { level: q.level } : {}),
    ...(q.free === true ? { OR: [{ price: null }, { price: 0 }] } : {}),
    ...(q.free === false ? { price: { gt: 0 } } : {}),
    ...(q.partner ? { partner: { slug: q.partner, published: true, deletedAt: null } } : {}),
  };
  const courses = await prisma.course.findMany({
    where,
    include: {
      partner: { select: { id: true, slug: true, tradeName: true, logoUrl: true } },
      category: { select: { key: true, label: true } },
      _count: { select: { lessons: true, enrollments: true } },
    },
    orderBy: [{ ratingAvg: "desc" }, { createdAt: "desc" }],
  });
  const filtered = q.species ? courses.filter((c) => ((c.speciesKeys as string[] | null) ?? []).includes(q.species!)) : courses;
  const start = (q.page - 1) * q.pageSize;
  return { items: filtered.slice(start, start + q.pageSize), total: filtered.length };
}

/** Public course page: structure only (lesson bodies/videos are for enrolled students). */
export async function getPublicCourse(id: string) {
  const c = await prisma.course.findFirst({
    where: { id, status: "PUBLISHED", partner: { published: true, deletedAt: null } },
    include: {
      partner: { select: { id: true, slug: true, tradeName: true, logoUrl: true, ratingAvg: true, ratingCount: true } },
      category: { select: { key: true, label: true } },
      modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, description: true, durationMinutes: true, exerciseTitle: true, sortOrder: true } } } },
      lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, description: true, durationMinutes: true, exerciseTitle: true, sortOrder: true, moduleId: true } },
      reviews: { where: { status: "VISIBLE" }, include: publicReviewInclude, orderBy: { createdAt: "desc" } },
      _count: { select: { lessons: true, enrollments: true } },
    },
  });
  if (!c) throw Errors.notFound("Curso não encontrado");
  return c;
}
