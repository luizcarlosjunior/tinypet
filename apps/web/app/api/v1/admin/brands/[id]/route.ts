import { brandSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("brand", brandSchema, { include: { lines: { orderBy: { name: "asc" } } } });
export const GET = routes.get;
export const PATCH = routes.update;
export const DELETE = routes.remove;
