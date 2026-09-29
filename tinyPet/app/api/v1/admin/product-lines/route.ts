import { productLineSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("productLine", productLineSchema, { include: { brand: { select: { id: true, name: true } } }, orderBy: { name: "asc" }, listWhere: (p) => (p.get("brandId") ? { brandId: p.get("brandId")! } : {}) });
export const GET = routes.list;
export const POST = routes.create;
