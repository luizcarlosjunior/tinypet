import { skillAdminSchema } from "@tinypet/shared";
import { crudRoutes, skillCrudOptions } from "@/server/admin";

const routes = crudRoutes("skill", skillAdminSchema, skillCrudOptions);
export const GET = routes.list;
export const POST = routes.create;
