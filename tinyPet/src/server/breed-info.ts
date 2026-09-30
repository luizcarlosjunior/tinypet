import { prisma, Prisma } from "@/db";
import { Errors } from "./errors";

/**
 * Breed facts from API Ninjas (https://api-ninjas.com/api/dogs, /cats), cached in the database to save credits:
 * - raw responses live in `ApiCache` (key "api-ninjas:<dogs|cats>:<query>") and never expire;
 * - an empty result is cached too and retried only after NOT_FOUND_RETRY_DAYS;
 * - concurrent lookups of the same query share one request;
 * - the normalized result (metric units, pt-BR labels) is stored on `Breed.info`.
 * The provider is called only on a cache miss (or an admin refresh). Needs API_NINJAS_KEY.
 */

const PROVIDER = "api-ninjas";
const NOT_FOUND_RETRY_DAYS = 30;
const LB = 0.45359237;
const INCH = 2.54;

export type Range = { min: number; max: number };
export type BreedTrait = { key: string; label: string; value: number; low: string; high: string };
export type BreedInfo = {
  source: "api-ninjas";
  species: "dog" | "cat";
  externalName: string;
  imageUrl: string | null;
  lifeYears: Range | null;
  /** Dogs: by sex. Cats: `any`. */
  weightKg: { male?: Range | null; female?: Range | null; any?: Range | null };
  heightCm: { male?: Range | null; female?: Range | null } | null;
  lengthText: string | null;
  origin: string | null;
  traits: BreedTrait[];
};

const DOG_TRAITS: [key: string, label: string, low: string, high: string][] = [
  ["energy", "Energia", "Calmo", "Muito ativo"],
  ["playfulness", "Brincalhão", "Sério", "Muito brincalhão"],
  ["trainability", "Facilidade de treino", "Difícil", "Fácil"],
  ["good_with_children", "Com crianças", "Pouco", "Ótimo"],
  ["good_with_other_dogs", "Com outros cães", "Pouco", "Ótimo"],
  ["good_with_strangers", "Com estranhos", "Reservado", "Sociável"],
  ["protectiveness", "Proteção", "Pouca", "Muita"],
  ["barking", "Latidos", "Poucos", "Muitos"],
  ["shedding", "Queda de pelo", "Pouca", "Muita"],
  ["grooming", "Cuidados com pelagem", "Poucos", "Muitos"],
  ["drooling", "Baba", "Pouca", "Muita"],
  ["coat_length", "Comprimento do pelo", "Curto", "Longo"],
];
const CAT_TRAITS: [key: string, label: string, low: string, high: string][] = [
  ["playfulness", "Brincalhão", "Sério", "Muito brincalhão"],
  ["intelligence", "Inteligência", "Pouca", "Muita"],
  ["family_friendly", "Carinho com a família", "Independente", "Muito carinhoso"],
  ["children_friendly", "Com crianças", "Pouco", "Ótimo"],
  ["other_pets_friendly", "Com outros pets", "Pouco", "Ótimo"],
  ["general_health", "Saúde geral", "Delicada", "Robusta"],
  ["shedding", "Queda de pelo", "Pouca", "Muita"],
  // API scale: 1 = high effort, 5 = low effort
  ["grooming", "Facilidade de cuidar do pelo", "Exige muito", "Exige pouco"],
];

type Raw = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const round1 = (n: number) => Math.round(n * 10) / 10;
function range(min: unknown, max: unknown, factor = 1): Range | null {
  const a = num(min);
  const b = num(max);
  if (a == null && b == null) return null;
  return { min: round1((a ?? b!) * factor), max: round1((b ?? a!) * factor) };
}
function traits(raw: Raw, defs: typeof DOG_TRAITS): BreedTrait[] {
  return defs.flatMap(([key, label, low, high]) => {
    const v = num(raw[key]);
    return v != null && v >= 1 && v <= 5 ? [{ key, label, value: v, low, high }] : [];
  });
}

/** Provider row → BreedProfile columns (metric units). */
export function profileColumns(kind: "dog" | "cat", raw: Raw): Omit<Prisma.BreedProfileUncheckedCreateInput, "id" | "fetchedAt" | "updatedAt"> {
  const kg = (v: unknown) => (num(v) == null ? null : round1(num(v)! * LB));
  const cm = (v: unknown) => (num(v) == null ? null : round1(num(v)! * INCH));
  const t = (v: unknown) => {
    const n = num(v);
    return n != null && n >= 1 && n <= 5 ? Math.round(n) : null;
  };
  const common = {
    speciesKey: kind,
    externalName: String(raw.name ?? "").trim(),
    source: PROVIDER,
    imageUrl: typeof raw.image_link === "string" && raw.image_link ? raw.image_link.slice(0, 500) : null,
    lifeMinYears: num(raw.min_life_expectancy),
    lifeMaxYears: num(raw.max_life_expectancy),
    playfulness: t(raw.playfulness),
    shedding: t(raw.shedding),
    grooming: t(raw.grooming),
  };
  if (kind === "dog") {
    return {
      ...common,
      weightMinKgMale: kg(raw.min_weight_male),
      weightMaxKgMale: kg(raw.max_weight_male),
      weightMinKgFemale: kg(raw.min_weight_female),
      weightMaxKgFemale: kg(raw.max_weight_female),
      heightMinCmMale: cm(raw.min_height_male),
      heightMaxCmMale: cm(raw.max_height_male),
      heightMinCmFemale: cm(raw.min_height_female),
      heightMaxCmFemale: cm(raw.max_height_female),
      energy: t(raw.energy),
      trainability: t(raw.trainability),
      goodWithChildren: t(raw.good_with_children),
      goodWithOtherDogs: t(raw.good_with_other_dogs),
      goodWithStrangers: t(raw.good_with_strangers),
      protectiveness: t(raw.protectiveness),
      barking: t(raw.barking),
      drooling: t(raw.drooling),
      coatLength: t(raw.coat_length),
    };
  }
  return {
    ...common,
    origin: typeof raw.origin === "string" ? raw.origin.slice(0, 120) : null,
    lengthText: typeof raw.length === "string" ? raw.length.slice(0, 120) : null,
    weightMinKg: kg(raw.min_weight),
    weightMaxKg: kg(raw.max_weight),
    intelligence: t(raw.intelligence),
    familyFriendly: t(raw.family_friendly),
    goodWithChildren: t(raw.children_friendly),
    otherPetsFriendly: t(raw.other_pets_friendly),
    generalHealth: t(raw.general_health),
  };
}

type Profile = Prisma.BreedProfileGetPayload<object>;
const rng = (min: number | null, max: number | null): Range | null => (min == null && max == null ? null : { min: min ?? max!, max: max ?? min! });

/** BreedProfile row → API shape (ranges + labelled traits). */
export function toBreedInfo(p: Profile): BreedInfo {
  const kind = p.speciesKey === "cat" ? "cat" : "dog";
  const col: Record<string, number | null> = {
    energy: p.energy, playfulness: p.playfulness, trainability: p.trainability, intelligence: p.intelligence,
    good_with_children: p.goodWithChildren, children_friendly: p.goodWithChildren, good_with_other_dogs: p.goodWithOtherDogs,
    good_with_strangers: p.goodWithStrangers, family_friendly: p.familyFriendly, other_pets_friendly: p.otherPetsFriendly,
    protectiveness: p.protectiveness, barking: p.barking, shedding: p.shedding, grooming: p.grooming, drooling: p.drooling,
    coat_length: p.coatLength, general_health: p.generalHealth,
  };
  return {
    source: "api-ninjas",
    species: kind,
    externalName: p.externalName,
    imageUrl: p.imageUrl,
    lifeYears: rng(p.lifeMinYears, p.lifeMaxYears),
    weightKg: kind === "dog" ? { male: rng(p.weightMinKgMale, p.weightMaxKgMale), female: rng(p.weightMinKgFemale, p.weightMaxKgFemale) } : { any: rng(p.weightMinKg, p.weightMaxKg) },
    heightCm: kind === "dog" ? { male: rng(p.heightMinCmMale, p.heightMaxCmMale), female: rng(p.heightMinCmFemale, p.heightMaxCmFemale) } : null,
    lengthText: p.lengthText,
    origin: p.origin,
    traits: traits(col, kind === "dog" ? DOG_TRAITS : CAT_TRAITS),
  };
}

/** Picks the exact (case/accents-insensitive) name match, else the first result. */
export function pickResult<T extends { name?: unknown; externalName?: unknown }>(results: T[], query: string): T | null {
  const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return results.find((r) => norm(r.name ?? r.externalName) === norm(query)) ?? results[0] ?? null;
}

const inflight = new Map<string, Promise<Raw[] | null>>();

/**
 * Provider query, done at most once per query: `ApiCache` records every query (and "not found", retried after
 * NOT_FOUND_RETRY_DAYS). Every returned breed is replicated into BreedProfile. Returns null without API key.
 */
async function queryProvider(kind: "dog" | "cat", query: string, refresh = false): Promise<Raw[] | null> {
  const path = kind === "dog" ? "dogs" : "cats";
  const key = `${PROVIDER}:${path}:${query.trim().toLowerCase()}`;
  const cached = await prisma.apiCache.findUnique({ where: { key } });
  const staleNotFound = cached && cached.results === 0 && Date.now() - cached.fetchedAt.getTime() > NOT_FOUND_RETRY_DAYS * 86_400_000;
  if (cached && !refresh && !staleNotFound) {
    await prisma.apiCache.update({ where: { key }, data: { hits: { increment: 1 } } }).catch(() => undefined);
    return cached.payload as Raw[];
  }
  const apiKey = process.env.API_NINJAS_KEY;
  if (!apiKey) return null;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      const res = await fetch(`https://api.api-ninjas.com/v1/${path}?name=${encodeURIComponent(query.trim())}`, { headers: { "X-Api-Key": apiKey }, signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (!res.ok) throw Errors.badRequest(`API Ninjas respondeu ${res.status}`);
      const json = (await res.json()) as unknown;
      const rows = (Array.isArray(json) ? (json as Raw[]) : []).filter((r) => typeof r.name === "string" && r.name.trim());
      for (const r of rows) {
        const data = profileColumns(kind, r);
        await prisma.breedProfile.upsert({ where: { speciesKey_externalName: { speciesKey: kind, externalName: data.externalName } }, create: data, update: { ...data, fetchedAt: new Date() } });
      }
      await prisma.apiCache.upsert({
        where: { key },
        create: { key, provider: PROVIDER, payload: rows as Prisma.InputJsonValue, results: rows.length },
        update: { payload: rows as Prisma.InputJsonValue, results: rows.length, fetchedAt: new Date() },
      });
      return rows;
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

/** Name used for the lookup: the admin-set English name, else the breed name. */
const lookupName = (b: { externalName: string | null; name: string }) => (b.externalName?.trim() || b.name).trim();

/**
 * Breed facts for a dog/cat breed, from our BreedProfile table. Only when the breed isn't linked/found locally is
 * API Ninjas queried (and every returned breed stored). `refresh` (admin) forces a new provider query.
 */
export async function breedInfo(breedId: string, opts: { refresh?: boolean } = {}): Promise<BreedInfo | null> {
  const breed = await prisma.breed.findUnique({ where: { id: breedId }, select: { id: true, name: true, externalName: true, isMixed: true, isOther: true, profile: true, profileCheckedAt: true, species: { select: { key: true } } } });
  if (!breed) throw Errors.notFound("Raça não encontrada");
  const kind = breed.species.key;
  if ((kind !== "dog" && kind !== "cat") || breed.isMixed || breed.isOther) return null;
  if (breed.profile && !opts.refresh) return toBreedInfo(breed.profile);

  const name = lookupName(breed);
  // 1) our replicated data (MySQL default collation compares case-insensitively)
  let profile = opts.refresh ? null : await prisma.breedProfile.findFirst({ where: { speciesKey: kind, externalName: name } });
  // 2) provider, only on a local miss
  if (!profile) {
    const rows = await queryProvider(kind, name, opts.refresh);
    if (rows?.length) {
      const best = pickResult(rows, name);
      profile = best ? await prisma.breedProfile.findFirst({ where: { speciesKey: kind, externalName: String(best.name).trim() } }) : null;
    }
  }
  await prisma.breed.update({ where: { id: breed.id }, data: { profileId: profile?.id ?? null, profileCheckedAt: new Date() } });
  return profile ? toBreedInfo(profile) : null;
}
