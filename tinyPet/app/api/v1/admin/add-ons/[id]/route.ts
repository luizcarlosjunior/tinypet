import { addOnSchema, crudRoutes } from "@/server/admin";

const routes = crudRoutes("addOn", addOnSchema, { include: { feature: true } });
export const GET = routes.get;
export const PATCH = routes.update;
export const DELETE = routes.remove;
