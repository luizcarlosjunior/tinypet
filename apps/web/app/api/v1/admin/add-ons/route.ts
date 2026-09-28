import { addOnSchema, crudRoutes } from "@/server/admin";

const routes = crudRoutes("addOn", addOnSchema, { include: { feature: true }, orderBy: { name: "asc" } });
export const GET = routes.list;
export const POST = routes.create;
