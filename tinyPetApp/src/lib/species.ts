/**
 * Species key of a pet-like object. The API returns `speciesId` + `species: { id, key, label }` — it never sends
 * a flat `speciesKey` — so always derive it from `species.key` (flat field kept as a fallback).
 */
export function speciesKeyOf(p: { speciesKey?: string | null; species?: { key?: string | null } | string | null } | null | undefined): string | undefined {
  if (!p) return undefined;
  if (typeof p.species === "string") return p.species;
  return p.species?.key ?? p.speciesKey ?? undefined;
}
