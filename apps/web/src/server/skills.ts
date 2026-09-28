import { prisma, Prisma } from "@tinypet/db";
import { COMPARISON_MIN_GROUP, type LifeStage } from "@tinypet/shared";
import { Errors } from "./errors";
import { awardBadge } from "./badges";
import { dateOnly, lifeStageRules, petLifeStageSync, todaySP } from "./pets";

export async function petSkills(petId: string) {
  const pet = await prisma.pet.findUniqueOrThrow({ where: { id: petId }, select: { speciesId: true } });
  const [rows, available] = await Promise.all([
    prisma.petSkill.findMany({
      where: { petId },
      include: { skill: true, markedBy: { select: { id: true, name: true } }, markedByPartner: { select: { id: true, tradeName: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.skill.findMany({ where: { isCustom: false, OR: [{ speciesId: pet.speciesId }, { speciesId: null }] }, orderBy: { name: "asc" } }),
  ]);
  const used = new Set(rows.map((r) => r.skillId));
  return {
    skills: rows.map((r) => ({
      id: r.id,
      skillId: r.skillId,
      name: r.skill.name,
      key: r.skill.key,
      isCustom: r.skill.isCustom,
      level: r.level,
      masteredAt: r.masteredAt,
      validated: !!r.validatedByPartnerId,
      validatedAt: r.validatedAt,
      validatedByPartnerId: r.validatedByPartnerId,
      markedBy: r.markedByPartner ? { kind: "partner" as const, ...r.markedByPartner } : r.markedBy ? { kind: "user" as const, ...r.markedBy } : null,
      updatedAt: r.updatedAt,
    })),
    available: available.filter((s) => !used.has(s.id)).map((s) => ({ skillId: s.id, name: s.name, key: s.key })),
  };
}

export async function upsertPetSkill(
  petId: string,
  input: { skillId?: string; customName?: string; level: "LEARNING" | "SOMETIMES" | "MASTERED"; masteredAt?: string | null },
  actor: { userId: string; partnerId?: string },
) {
  const pet = await prisma.pet.findUniqueOrThrow({ where: { id: petId }, select: { name: true, speciesId: true } });
  let skillId = input.skillId;
  if (skillId) {
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw Errors.notFound("Comando não encontrado");
    if (skill.speciesId && skill.speciesId !== pet.speciesId) throw Errors.badRequest("Comando não é desta espécie");
  } else {
    const name = input.customName!.trim();
    const existing = await prisma.skill.findFirst({
      where: { isCustom: true, name, ...(actor.partnerId ? { createdByPartnerId: actor.partnerId } : { createdByUserId: actor.userId }) },
    });
    skillId =
      existing?.id ??
      (
        await prisma.skill.create({
          data: { name, isCustom: true, speciesId: pet.speciesId, createdByUserId: actor.partnerId ? null : actor.userId, createdByPartnerId: actor.partnerId ?? null },
        })
      ).id;
  }
  const current = await prisma.petSkill.findUnique({ where: { petId_skillId: { petId, skillId } } });
  // partners only change marks they made themselves; owner/family or other partners' marks stay (they can validate instead)
  if (actor.partnerId && current && current.markedByPartnerId !== actor.partnerId) {
    throw Errors.forbidden("Este comando foi registrado pelo tutor ou por outro parceiro. Use a validação.");
  }
  const masteredAt =
    input.level === "MASTERED" ? (input.masteredAt ? dateOnly(input.masteredAt) : current?.masteredAt ?? dateOnly(todaySP())) : null;
  const marked = actor.partnerId ? { markedByPartnerId: actor.partnerId, markedByUserId: null } : { markedByUserId: actor.userId, markedByPartnerId: null };
  const row = await prisma.petSkill.upsert({
    where: { petId_skillId: { petId, skillId } },
    update: { level: input.level, masteredAt, ...marked, ...(input.level !== "MASTERED" ? { validatedByPartnerId: null, validatedAt: null } : {}) },
    create: { petId, skillId, level: input.level, masteredAt, ...marked },
    include: { skill: true },
  });
  if (input.level === "MASTERED" && !current?.masteredAt) {
    await prisma.petHistoryEvent.create({
      data: {
        petId,
        type: "SKILL",
        title: `Dominou o comando "${row.skill.name}"`,
        occurredAt: masteredAt ?? new Date(),
        partnerId: actor.partnerId ?? null,
        userId: actor.partnerId ? null : actor.userId,
      },
    });
    const mastered = await prisma.petSkill.count({ where: { petId, level: "MASTERED" } });
    if (mastered >= 5) await awardBadge(petId, "five_commands");
    if (mastered >= 10) await awardBadge(petId, "ten_commands");
  }
  return row;
}

// ───────────────────────────── comparison ─────────────────────────────

type Scope = { label: "nearMe" | "city" | "state" | "Brasil"; state: string | null; city: string | null };

/**
 * Comparison against SkillStat rows (recomputed daily by /jobs/skill-stats).
 * Scope is narrowed by query flags in the order nearMe → city → state → Brasil and widened until `total >= 20`.
 * "nearMe" is approximated by the city of the tutor's primary address (SkillStat is aggregated by city, not by
 * coordinates); when neither coordinates nor a primary address city are available the scope widens automatically.
 */
export async function skillComparison(petId: string, q: { breed?: boolean; state?: boolean; city?: boolean; nearMe?: boolean; lat?: number; lng?: number }) {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, deletedAt: null },
    include: {
      species: { select: { key: true, label: true } },
      breed: { select: { id: true, name: true } },
      owner: { select: { addresses: { where: { isPrimary: true }, take: 1, select: { city: true, state: true, latitude: true, longitude: true } } } },
      skills: { where: { level: "MASTERED" }, include: { skill: { select: { isCustom: true } } } },
    },
  });
  if (!pet) throw Errors.notFound("Pet não encontrado");
  const rules = await lifeStageRules();
  const lifeStage = petLifeStageSync(pet, rules);
  const addr = pet.owner?.addresses[0];
  const home = { city: addr?.city ?? null, state: addr?.state ?? null };
  const breedId = q.breed && pet.breedId ? pet.breedId : null;
  const petMastered = pet.skills.filter((s) => !s.skill.isCustom).length;

  const candidates: Scope[] = [];
  const hasCoords = (q.lat != null && q.lng != null) || (addr?.latitude != null && addr?.longitude != null);
  if (q.nearMe && home.city && home.state) candidates.push({ label: "nearMe", state: home.state, city: home.city });
  if (q.city && home.city && home.state) candidates.push({ label: "city", state: home.state, city: home.city });
  if (q.state && home.state) candidates.push({ label: "state", state: home.state, city: null });
  candidates.push({ label: "Brasil", state: null, city: null });
  const requested = candidates.length - 1 + (q.nearMe && !(home.city && home.state) ? 1 : 0);

  if (!lifeStage) {
    return { scope: null, groupSize: 0, widened: false, lifeStage: null, perSkill: [], summary: { mastered: petMastered, percentile: null }, note: "Pet sem idade informada: sem grupo de comparação." };
  }

  let chosen: Scope | null = null;
  let rows: { skillId: string; total: number; mastered: number; skill: { name: string; key: string | null } }[] = [];
  let widened = false;
  let effectiveBreedId: string | null = breedId;
  let brasilRows: typeof rows = [];
  for (const c of candidates) {
    const found = await prisma.skillStat.findMany({
      where: { speciesId: pet.speciesId, lifeStage, breedId, state: c.state, city: c.city },
      include: { skill: { select: { name: true, key: true } } },
    });
    if (c.label === "Brasil") brasilRows = found;
    const total = found.reduce((m, r) => Math.max(m, r.total), 0);
    if (total >= COMPARISON_MIN_GROUP) {
      chosen = c;
      rows = found;
      break;
    }
    widened = true;
  }
  if (!chosen && breedId) {
    // Even Brasil is too small for this breed: drop the breed filter.
    const found = await prisma.skillStat.findMany({ where: { speciesId: pet.speciesId, lifeStage, breedId: null, state: null, city: null }, include: { skill: { select: { name: true, key: true } } } });
    const total = found.reduce((m, r) => Math.max(m, r.total), 0);
    if (total >= COMPARISON_MIN_GROUP || total > 0) {
      chosen = { label: "Brasil", state: null, city: null };
      rows = found;
      effectiveBreedId = null;
    }
  }
  if (!chosen) {
    // Nothing reaches the minimum group: show the widest scope available (may be below 20, flagged by `widened`).
    chosen = candidates[candidates.length - 1]!;
    rows = brasilRows;
    widened = requested > 0 || rows.reduce((m, r) => Math.max(m, r.total), 0) < COMPARISON_MIN_GROUP;
  }
  const groupSize = rows.reduce((m, r) => Math.max(m, r.total), 0);
  const perSkill = rows
    .map((r) => ({ skillId: r.skillId, name: r.skill.name, key: r.skill.key, pct: r.total ? Math.round((r.mastered / r.total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);

  // Percentile computed live from PetSkill over consenting pets in the chosen scope (capped at 5000 pets).
  const peers = await prisma.pet.findMany({
    where: {
      id: { not: petId },
      deletedAt: null,
      status: "ACTIVE",
      speciesId: pet.speciesId,
      ...(effectiveBreedId ? { breedId: effectiveBreedId } : {}),
      owner: {
        is: {
          statsConsent: true,
          deletedAt: null,
          ...(chosen.city || chosen.state
            ? { addresses: { some: { isPrimary: true, ...(chosen.state ? { state: chosen.state } : {}), ...(chosen.city ? { city: chosen.city } : {}) } } }
            : {}),
        },
      },
      skills: { some: {} },
    },
    select: { birthDate: true, approxAgeMonths: true, size: true, species: { select: { key: true } }, skills: { where: { level: "MASTERED", skill: { isCustom: false } }, select: { id: true } } },
    take: 5000,
  });
  const peerCounts = peers.filter((p) => petLifeStageSync(p, rules) === lifeStage).map((p) => p.skills.length);
  const percentile = peerCounts.length ? Math.round((peerCounts.filter((c) => c < petMastered).length / peerCounts.length) * 100) : null;

  return {
    scope: { ...chosen, breed: effectiveBreedId ? pet.breed : null, species: pet.species, lifeStage, coordinatesUsed: hasCoords && chosen.label === "nearMe" },
    groupSize,
    widened,
    lifeStage,
    perSkill,
    summary: { mastered: petMastered, percentile, peers: peerCounts.length },
  };
}

// ───────────────────────────── stats job ─────────────────────────────

/** Recomputes SkillStat: system skill × species × lifeStage × (breed|null) × (state|null) × (city|null) over consenting pets. */
export async function recomputeSkillStats() {
  const rules = await lifeStageRules();
  const [skills, pets] = await Promise.all([
    prisma.skill.findMany({ where: { isCustom: false }, select: { id: true, speciesId: true } }),
    prisma.pet.findMany({
      where: { deletedAt: null, status: "ACTIVE", owner: { is: { statsConsent: true, deletedAt: null } }, skills: { some: {} } },
      select: {
        id: true,
        speciesId: true,
        breedId: true,
        size: true,
        birthDate: true,
        approxAgeMonths: true,
        species: { select: { key: true } },
        owner: { select: { addresses: { where: { isPrimary: true }, take: 1, select: { city: true, state: true } } } },
        skills: { where: { level: "MASTERED" }, select: { skillId: true } },
      },
    }),
  ]);

  type P = { speciesId: string; breedId: string | null; lifeStage: LifeStage; state: string | null; city: string | null; mastered: Set<string> };
  const prepared: P[] = [];
  for (const p of pets) {
    const lifeStage = petLifeStageSync(p, rules);
    if (!lifeStage) continue;
    const a = p.owner?.addresses[0];
    prepared.push({ speciesId: p.speciesId, breedId: p.breedId, lifeStage, state: a?.state ?? null, city: a?.city ?? null, mastered: new Set(p.skills.map((s) => s.skillId)) });
  }

  // group key → pets
  const groups = new Map<string, { speciesId: string; lifeStage: LifeStage; breedId: string | null; state: string | null; city: string | null; pets: P[] }>();
  const add = (key: string, dims: { speciesId: string; lifeStage: LifeStage; breedId: string | null; state: string | null; city: string | null }, p: P) => {
    let g = groups.get(key);
    if (!g) {
      g = { ...dims, pets: [] };
      groups.set(key, g);
    }
    g.pets.push(p);
  };
  for (const p of prepared) {
    const breedOpts: (string | null)[] = p.breedId ? [null, p.breedId] : [null];
    const locOpts: { state: string | null; city: string | null }[] = [{ state: null, city: null }];
    if (p.state) locOpts.push({ state: p.state, city: null });
    if (p.state && p.city) locOpts.push({ state: p.state, city: p.city });
    for (const breedId of breedOpts) {
      for (const loc of locOpts) {
        const dims = { speciesId: p.speciesId, lifeStage: p.lifeStage, breedId, state: loc.state, city: loc.city };
        add(`${dims.speciesId}|${dims.lifeStage}|${breedId ?? ""}|${loc.state ?? ""}|${loc.city ?? ""}`, dims, p);
      }
    }
  }

  const computedAt = new Date();
  const rows: Prisma.SkillStatCreateManyInput[] = [];
  for (const g of groups.values()) {
    for (const s of skills) {
      if (s.speciesId && s.speciesId !== g.speciesId) continue;
      rows.push({ skillId: s.id, speciesId: g.speciesId, breedId: g.breedId, lifeStage: g.lifeStage, state: g.state, city: g.city, total: g.pets.length, mastered: g.pets.filter((p) => p.mastered.has(s.id)).length, computedAt });
    }
  }
  await prisma.skillStat.deleteMany({});
  for (let i = 0; i < rows.length; i += 500) await prisma.skillStat.createMany({ data: rows.slice(i, i + 500) });
  return { pets: prepared.length, groups: groups.size, rows: rows.length };
}
