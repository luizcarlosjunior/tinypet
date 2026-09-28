import { petSkillSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor } from "@/server/pets";
import { petSkills, upsertPetSkill } from "@/server/skills";

/** Pet skills + available system skills for its species (not yet marked). */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  await petActor(req, params.id, "VIEW");
  return ok(await petSkills(params.id));
});

/** Upsert by skillId, or create a custom skill from `customName`. MASTERED sets masteredAt and writes a SKILL history event. */
export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.pet.status === "DECEASED") throw Errors.conflict("Pet em memorial");
  const body = await parseBody(req, petSkillSchema);
  await upsertPetSkill(params.id, body, { userId: actor.user.id, partnerId: actor.via === "partner" ? actor.partnerId : undefined });
  return ok(await petSkills(params.id));
});
