import { speciesSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("species", speciesSchema, { include: { breeds: { orderBy: { name: "asc" } } }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
export const GET = routes.list;
export const POST = routes.create;
