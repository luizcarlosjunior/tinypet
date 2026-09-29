import { ownerTermSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("ownerTerm", ownerTermSchema, { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
export const GET = routes.list;
export const POST = routes.create;
