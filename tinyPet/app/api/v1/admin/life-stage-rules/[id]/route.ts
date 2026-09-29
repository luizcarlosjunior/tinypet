import { lifeStageRuleSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("lifeStageRule", lifeStageRuleSchema, { include: { species: { select: { id: true, key: true, label: true } } }, orderBy: [{ speciesId: "asc" }, { size: "asc" }] });
export const GET = routes.get;
export const PATCH = routes.update;
export const DELETE = routes.remove;
