import { subcategorySchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("subcategory", subcategorySchema, { include: { category: { select: { id: true, key: true, label: true } } }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], listWhere: (p) => (p.get("categoryId") ? { categoryId: p.get("categoryId")! } : {}) });
export const GET = routes.list;
export const POST = routes.create;
