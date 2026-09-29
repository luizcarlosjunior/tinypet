import { badgeSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("badge", badgeSchema, { orderBy: { name: "asc" }, listWhere: (p) => (p.get("system") === "true" ? { partnerId: null } : {}) });
export const GET = routes.get;
export const PATCH = routes.update;
export const DELETE = routes.remove;
