import { productLineSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("productLine", productLineSchema, { include: { brand: { select: { id: true, name: true } } }, orderBy: { name: "asc" }, listWhere: (p) => (p.get("brandId") ? { brandId: p.get("brandId")! } : {}) });
export const GET = routes.get;
export const PATCH = routes.update;
export const DELETE = routes.remove;
