import { productFlavorSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("productFlavor", productFlavorSchema, { include: { line: { select: { id: true, name: true, brandId: true } } }, orderBy: { name: "asc" }, listWhere: (p) => (p.get("lineId") ? { lineId: p.get("lineId")! } : {}) });
export const GET = routes.get;
export const PATCH = routes.update;
export const DELETE = routes.remove;
