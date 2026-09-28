import { z } from "zod";
import { paginationQuery, CourseLevelEnum } from "@tinypet/shared";
import { handler, ok, parseQuery, serialize } from "@/server";
import { listPublicCourses } from "@/server/public";

const publicCoursesQuery = paginationQuery.extend({
  q: z.string().optional(),
  category: z.string().optional(),
  species: z.string().optional(),
  level: CourseLevelEnum.optional(),
  free: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  partner: z.string().optional(),
});

export const GET = handler(async (req) => {
  const q = parseQuery(req, publicCoursesQuery);
  const { items, total } = await listPublicCourses(q);
  return ok(serialize(items), { meta: { page: q.page, pageSize: q.pageSize, total } });
});
