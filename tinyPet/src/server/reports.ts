import { prisma, Prisma } from "@/db";
import { formatAge, LIFE_STAGE_LABEL, type LifeStage } from "@tinypet/shared";
import { lifeStageRules, petAgeMonths, petLifeStageSync, ymd } from "./pets";
import { clientIdsByTag } from "./crm";
import { toCsv } from "./csv";

export type ReportMode = { kind: "partner"; partnerId: string } | { kind: "admin" };

export type PetReportQuery = {
  page: number;
  pageSize: number;
  species?: string;
  breedId?: string;
  lifeStage?: LifeStage;
  bornFrom?: string;
  bornTo?: string;
  birthMonth?: number;
  ageMinMonths?: number;
  ageMaxMonths?: number;
  state?: string;
  city?: string;
  district?: string;
  sex?: "MALE" | "FEMALE";
  size?: "SMALL" | "MEDIUM" | "LARGE" | "GIANT";
  neutered?: boolean;
  status?: "ACTIVE" | "DECEASED";
  tag?: string;
  groupBy?: "state" | "city" | "species" | "breed" | "lifeStage" | "birthMonth" | "createdMonth";
};

const MASK = "menos de 5";
const MASK_BELOW = 5;

const addressSelect = { where: { isPrimary: true }, take: 1, select: { city: true, state: true, district: true } } as const;

const reportInclude = (mode: ReportMode) =>
  ({
    species: { select: { key: true, label: true } },
    breed: { select: { id: true, name: true } },
    owner: { select: { id: true, name: true, email: true, addresses: addressSelect } },
    clients:
      mode.kind === "partner"
        ? {
            where: { client: { partnerId: mode.partnerId, deletedAt: null } },
            select: {
              client: {
                select: {
                  id: true,
                  name: true,
                  tags: true,
                  userId: true,
                  addresses: addressSelect,
                  phones: { where: { isPrimary: true }, take: 1, select: { number: true } },
                  emails: { where: { isPrimary: true }, take: 1, select: { address: true } },
                },
              },
            },
          }
        : false,
  }) satisfies Prisma.PetInclude;

type ReportPet = Prisma.PetGetPayload<{ include: ReturnType<typeof reportInclude> }> & {
  clients?: { client: { id: string; name: string; tags: unknown; userId: string | null; addresses: { city: string; state: string; district: string | null }[]; phones: { number: string }[]; emails: { address: string }[] } }[];
};

export async function petReportRows(mode: ReportMode, q: PetReportQuery) {
  const rules = await lifeStageRules();
  const loc = { ...(q.state ? { state: q.state.toUpperCase() } : {}), ...(q.city ? { city: q.city } : {}), ...(q.district ? { district: q.district } : {}) };
  const hasLoc = Object.keys(loc).length > 0;
  const and: Prisma.PetWhereInput[] = [{ deletedAt: null, status: q.status ?? "ACTIVE" }];
  if (mode.kind === "partner") {
    const clientFilter: Prisma.ClientWhereInput = { partnerId: mode.partnerId, deletedAt: null };
    if (hasLoc) clientFilter.addresses = { some: { isPrimary: true, ...loc } };
    if (q.tag) clientFilter.id = { in: await clientIdsByTag(mode.partnerId, q.tag) };
    and.push({ clients: { some: { client: clientFilter } } });
  } else if (hasLoc) {
    and.push({ owner: { is: { addresses: { some: { isPrimary: true, ...loc } } } } });
  }
  if (q.species) and.push({ species: { key: q.species } });
  if (q.breedId) and.push({ breedId: q.breedId });
  if (q.sex) and.push({ sex: q.sex });
  if (q.size) and.push({ size: q.size });
  if (q.neutered !== undefined) and.push({ neutered: q.neutered });
  if (q.bornFrom) and.push({ birthDate: { gte: new Date(`${q.bornFrom}T00:00:00Z`) } });
  if (q.bornTo) and.push({ birthDate: { lte: new Date(`${q.bornTo}T00:00:00Z`) } });

  const pets = (await prisma.pet.findMany({ where: { AND: and }, include: reportInclude(mode), orderBy: { name: "asc" }, take: 20_000 })) as ReportPet[];
  const now = new Date();
  const rows = pets
    .map((p) => {
      const ageMonths = petAgeMonths(p, now);
      const lifeStage = petLifeStageSync(p, rules, now);
      const client = p.clients?.[0]?.client ?? null;
      const addr = (mode.kind === "partner" ? client?.addresses[0] : null) ?? p.owner?.addresses[0] ?? null;
      const birthMonth = p.birthDate ? Number(ymd(p.birthDate).slice(5, 7)) : null;
      return {
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        species: p.species,
        breed: p.breed,
        sex: p.sex,
        size: p.size,
        neutered: p.neutered,
        status: p.status,
        birthDate: p.birthDate ? ymd(p.birthDate) : null,
        birthMonth,
        ageMonths,
        ageLabel: formatAge(ageMonths),
        lifeStage,
        lifeStageLabel: lifeStage ? LIFE_STAGE_LABEL[lifeStage] : "idade desconhecida",
        city: addr?.city ?? null,
        state: addr?.state ?? null,
        district: addr?.district ?? null,
        createdAt: p.createdAt,
        createdMonth: p.createdAt.toISOString().slice(0, 7),
        tutor:
          mode.kind === "partner"
            ? {
                clientId: client?.id ?? null,
                name: client?.name ?? p.owner?.name ?? null,
                linked: !!client?.userId,
                tags: (client?.tags as string[] | null) ?? [],
                phone: client?.phones[0]?.number ?? null,
                email: client?.emails[0]?.address ?? p.owner?.email ?? null,
              }
            : null,
      };
    })
    .filter((r) => {
      if (q.lifeStage && r.lifeStage !== q.lifeStage) return false;
      if (q.birthMonth && r.birthMonth !== q.birthMonth) return false;
      if (q.ageMinMonths != null && (r.ageMonths == null || r.ageMonths < q.ageMinMonths)) return false;
      if (q.ageMaxMonths != null && (r.ageMonths == null || r.ageMonths > q.ageMaxMonths)) return false;
      return true;
    });
  return rows;
}

export type ReportRow = Awaited<ReturnType<typeof petReportRows>>[number];

function groupKey(r: ReportRow, by: NonNullable<PetReportQuery["groupBy"]>): string {
  switch (by) {
    case "state":
      return r.state ?? "—";
    case "city":
      return r.city ? `${r.city}/${r.state ?? ""}` : "—";
    case "species":
      return r.species.label;
    case "breed":
      return r.breed?.name ?? "—";
    case "lifeStage":
      return r.lifeStageLabel;
    case "birthMonth":
      return r.birthMonth ? String(r.birthMonth).padStart(2, "0") : "—";
    case "createdMonth":
      return r.createdMonth;
  }
}

export function groupRows(rows: ReportRow[], by: NonNullable<PetReportQuery["groupBy"]>, mask: boolean) {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(groupKey(r, by), (counts.get(groupKey(r, by)) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count: mask && count < MASK_BELOW ? (MASK as string | number) : count }));
}

/** Partner: own book with tutor contact. Admin: aggregated only (no items), groups < 5 masked as "menos de 5". */
export async function petReport(mode: ReportMode, q: PetReportQuery) {
  const rows = await petReportRows(mode, q);
  if (mode.kind === "admin") {
    const by = q.groupBy ?? "species";
    return { items: [], groups: groupRows(rows, by, true), groupBy: by, total: rows.length < MASK_BELOW ? (MASK as string | number) : rows.length, aggregated: true };
  }
  const start = (q.page - 1) * q.pageSize;
  return { items: rows.slice(start, start + q.pageSize), groups: q.groupBy ? groupRows(rows, q.groupBy, false) : [], groupBy: q.groupBy ?? null, total: rows.length, aggregated: false };
}

export async function petReportCsv(mode: ReportMode, q: PetReportQuery) {
  const rows = await petReportRows(mode, q);
  if (mode.kind === "admin") {
    const by = q.groupBy ?? "species";
    return toCsv(groupRows(rows, by, true) as unknown as Record<string, unknown>[], [
      { key: "key", label: by },
      { key: "count", label: "pets" },
    ]);
  }
  return toCsv(rows as unknown as Record<string, unknown>[], [
    { key: "name", label: "pet" },
    { key: "species", label: "species", get: (r) => (r as unknown as ReportRow).species.label },
    { key: "breed", label: "breed", get: (r) => (r as unknown as ReportRow).breed?.name ?? "" },
    { key: "sex", label: "sex" },
    { key: "size", label: "size" },
    { key: "neutered", label: "neutered", get: (r) => ((r as unknown as ReportRow).neutered == null ? "" : (r as unknown as ReportRow).neutered ? "sim" : "não") },
    { key: "status", label: "status" },
    { key: "birthDate", label: "birthDate" },
    { key: "ageLabel", label: "age" },
    { key: "lifeStageLabel", label: "lifeStage" },
    { key: "tutor", label: "tutor", get: (r) => (r as unknown as ReportRow).tutor?.name ?? "" },
    { key: "phone", label: "phone", get: (r) => (r as unknown as ReportRow).tutor?.phone ?? "" },
    { key: "email", label: "email", get: (r) => (r as unknown as ReportRow).tutor?.email ?? "" },
    { key: "city", label: "city" },
    { key: "state", label: "state" },
    { key: "district", label: "district" },
    { key: "tags", label: "tags", get: (r) => (r as unknown as ReportRow).tutor?.tags ?? [] },
    { key: "createdAt", label: "createdAt" },
  ]);
}

/** Demand by brand and city (owner's primary address; falls back to the client's address for partner-created pets). No tutor identification. */
export async function brandsReport(mode: ReportMode, q: { species?: string; state?: string; city?: string }) {
  const foods = await prisma.petFood.findMany({
    where: {
      brandId: { not: null },
      pet: {
        deletedAt: null,
        status: "ACTIVE",
        ...(q.species ? { species: { key: q.species } } : {}),
        ...(mode.kind === "partner" ? { clients: { some: { client: { partnerId: mode.partnerId, deletedAt: null } } } } : {}),
      },
    },
    select: {
      petId: true,
      type: true,
      brand: { select: { id: true, name: true } },
      productLine: { select: { id: true, name: true } },
      pet: {
        select: {
          species: { select: { key: true, label: true } },
          owner: { select: { addresses: addressSelect } },
          clients: mode.kind === "partner" ? { where: { client: { partnerId: mode.partnerId } }, select: { client: { select: { addresses: addressSelect } } }, take: 1 } : false,
        },
      },
    },
  });
  type Row = { brandId: string; brand: string; city: string | null; state: string | null; pets: Set<string>; species: Map<string, number> };
  const groups = new Map<string, Row>();
  const brandTotals = new Map<string, { brandId: string; brand: string; pets: Set<string> }>();
  for (const f of foods) {
    const clientAddr = (f.pet as unknown as { clients?: { client: { addresses: { city: string; state: string }[] } }[] }).clients?.[0]?.client.addresses[0];
    const addr = f.pet.owner?.addresses[0] ?? clientAddr ?? null;
    if (q.state && addr?.state?.toUpperCase() !== q.state.toUpperCase()) continue;
    if (q.city && addr?.city !== q.city) continue;
    const key = `${f.brand!.id}|${addr?.city ?? ""}|${addr?.state ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { brandId: f.brand!.id, brand: f.brand!.name, city: addr?.city ?? null, state: addr?.state ?? null, pets: new Set(), species: new Map() };
      groups.set(key, g);
    }
    if (!g.pets.has(f.petId)) g.species.set(f.pet.species.label, (g.species.get(f.pet.species.label) ?? 0) + 1);
    g.pets.add(f.petId);
    let t = brandTotals.get(f.brand!.id);
    if (!t) {
      t = { brandId: f.brand!.id, brand: f.brand!.name, pets: new Set() };
      brandTotals.set(f.brand!.id, t);
    }
    t.pets.add(f.petId);
  }
  const mask = (n: number) => (mode.kind === "admin" && n < MASK_BELOW ? (MASK as string | number) : n);
  return {
    byBrandCity: Array.from(groups.values())
      .sort((a, b) => b.pets.size - a.pets.size)
      .map((g) => ({ brandId: g.brandId, brand: g.brand, city: g.city, state: g.state, pets: mask(g.pets.size), species: Object.fromEntries(g.species) })),
    byBrand: Array.from(brandTotals.values())
      .sort((a, b) => b.pets.size - a.pets.size)
      .map((t) => ({ brandId: t.brandId, brand: t.brand, pets: mask(t.pets.size) })),
    totalPets: mask(new Set(foods.map((f) => f.petId)).size),
  };
}

/** Resolves partner (X-Partner-Id) vs admin report mode from the request. */
export async function reportMode(req: import("next/server").NextRequest): Promise<ReportMode> {
  const { requirePartner, requireAdmin } = await import("./auth");
  // ?partnerId= too: the panel downloads the CSV with a plain link (no custom headers)
  if (req.headers.get("x-partner-id") || req.nextUrl.searchParams.get("partnerId")) return { kind: "partner", partnerId: (await requirePartner(req)).partnerId };
  await requireAdmin(req);
  return { kind: "admin" };
}
