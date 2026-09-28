import { lifeStageRuleSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("lifeStageRule", lifeStageRuleSchema, { include: { species: { select: { id: true, key: true, label: true } } }, orderBy: [{ speciesId: "asc" }, { size: "asc" }] });
export const GET = routes.list;
export const POST = routes.create;
