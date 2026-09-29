import { handler, ok } from "@/server";
import { categoryTree } from "@/server/blog/categories";

/** GET /blog/categories → active category tree (published post counts). */
export const GET = handler(async () => ok(await categoryTree({ publicOnly: true })));
