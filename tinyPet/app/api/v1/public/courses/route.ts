import { z } from "zod";
import { paginationQuery, CourseLevelEnum } from "@tinypet/shared";
import { handler, ok, parseQuery, serialize } from "@/server";
import { listPublicCourses } from "@/server/public";

const publicCoursesQuery = paginationQuery.extend({
  q: z.string().max(200).optional(),
  category: z.string().max(60).optional(),
  species: z.string().max(60).optional(),
  level: CourseLevelEnum.optional(),
  free: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  partner: z.string().max(120).optional(),
});

export const GET = handler(async (req) => {
  const q = parseQuery(req, publicCoursesQuery);
  const { items, total } = await listPublicCourses(q);
  return ok(serialize(items), { meta: { page: q.page, pageSize: q.pageSize, total }, cache: 60 });
});
