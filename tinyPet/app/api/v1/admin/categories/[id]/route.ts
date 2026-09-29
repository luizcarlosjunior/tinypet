import { categorySchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("category", categorySchema, { include: { subcategories: { orderBy: { sortOrder: "asc" } } }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
export const GET = routes.get;
export const PATCH = routes.update;
export const DELETE = routes.remove;
