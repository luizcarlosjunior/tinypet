import { breedSchema } from "@tinypet/shared";
import { crudRoutes } from "@/server/admin";

const routes = crudRoutes("breed", breedSchema, { include: { species: { select: { id: true, key: true, label: true } } }, orderBy: { name: "asc" }, listWhere: (p) => (p.get("speciesId") ? { speciesId: p.get("speciesId")! } : {}) });
export const GET = routes.list;
export const POST = routes.create;
