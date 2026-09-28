import { skillAdminSchema } from "@tinypet/shared";
import { crudRoutes, skillCrudOptions } from "@/server/admin";

const routes = crudRoutes("skill", skillAdminSchema, skillCrudOptions);
export const GET = routes.get;
export const PATCH = routes.update;
export const DELETE = routes.remove;
