import { skillComparisonQuery } from "@tinypet/shared";
import { handler, ok, parseQuery } from "@/server";
import { petActor } from "@/server/pets";
import { skillComparison } from "@/server/skills";

/** Reads SkillStat (daily job). Scope narrows nearMe → city → state → Brasil and widens until ≥ 20 pets. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  const q = parseQuery(req, skillComparisonQuery);
  return ok(await skillComparison(params.id, q));
});
