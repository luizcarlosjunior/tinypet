import { brandSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("brand", brandSchema, {
  include: { lines: { orderBy: { name: "asc" } } },
  orderBy: { name: "asc" },
  listWhere: (p) => ({ ...(p.get("status") ? { status: p.get("status") } : {}), ...(p.get("q") ? { name: { contains: p.get("q")! } } : {}) }),
});
export const GET = routes.list;
export const POST = routes.create;
