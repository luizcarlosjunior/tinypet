import { categorySchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("category", categorySchema, { include: { subcategories: { orderBy: { sortOrder: "asc" } } }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
export const GET = routes.list;
export const POST = routes.create;
