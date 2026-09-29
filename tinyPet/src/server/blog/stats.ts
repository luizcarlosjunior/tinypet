import { z } from "zod";
import { prisma, type Prisma } from "@/db";
import { Errors } from "../errors";
import { buildSeries, liveDayRows, resolvePeriod, type DayRow, type ResolvedPeriod } from "./period";
import { addDays, dateOnly, dayKeyOf, spDayKey, spDayStart } from "./utils";

export const statsQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "12m", "custom"]).default("30d"),
  from: z.string().optional(),
  to: z.string().optional(),
  postId: z.string().optional(),
  categoryId: z.string().optional(),
});

const LOG_RETENTION_DAYS = 90;

async function postFilter(q: { postId?: string; categoryId?: string }): Promise<Prisma.BlogPostWhereInput | null> {
  if (q.postId) return { id: q.postId };
  if (q.categoryId) {
    const children = await prisma.blogCategory.findMany({ where: { parentId: q.categoryId }, select: { id: true } });
    return { categories: { some: { categoryId: { in: [q.categoryId, ...children.map((c) => c.id)] } } } };
  }
  return null;
}

function viewsByPostOf(logs: { postId: string }[]) {
  const byPost = new Map<string, number>();
  for (const l of logs) byPost.set(l.postId, (byPost.get(l.postId) ?? 0) + 1);
  return byPost;
}

export async function blogStats(input: z.infer<typeof statsQuerySchema>, now = new Date()) {
  let p: ResolvedPeriod;
  try {
    p = resolvePeriod(input, now);
  } catch (e) {
    throw Errors.badRequest(e instanceof Error ? e.message : "Período inválido");
  }
  const filter = await postFilter(input);
  const postWhere = filter ?? {};
  const postRel = filter ? { post: filter } : {};
  const fromInstant = spDayStart(p.from);
  const toInstant = spDayStart(addDays(p.to, 1));
  const dayRange = { gte: dateOnly(p.from), lte: dateOnly(p.to) };
  const createdRange = { gte: fromInstant, lt: toInstant };
  const logsFrom = new Date(Math.max(fromInstant.getTime(), spDayStart(addDays(spDayKey(now), -(LOG_RETENTION_DAYS - 1))).getTime()));

  const [dailyByDay, dailyByPost, unprocessed, publishedPosts, hearts, comments, refRows, devRows] = await Promise.all([
    prisma.blogPostDailyStat.groupBy({ by: ["day"], where: { day: dayRange, ...postRel }, _sum: { views: true, visitors: true } }),
    prisma.blogPostDailyStat.groupBy({ by: ["postId"], where: { day: dayRange, ...postRel }, _sum: { views: true } }),
    prisma.blogPostViewLog.findMany({ where: { processed: false, createdAt: createdRange, ...postRel }, select: { postId: true, visitorHash: true, createdAt: true } }),
    prisma.blogPost.findMany({ where: { ...postWhere, status: "PUBLISHED", deletedAt: null, publishDate: { gte: fromInstant, lt: toInstant, lte: now } }, select: { publishDate: true } }),
    prisma.blogPostHeart.count({ where: { createdAt: createdRange, post: { deletedAt: null, ...postWhere } } }),
    prisma.blogComment.count({ where: { createdAt: createdRange, status: "VISIBLE", deletedAt: null, post: { deletedAt: null, ...postWhere } } }),
    prisma.blogPostViewLog.groupBy({ by: ["referrerHost"], where: { createdAt: { gte: logsFrom, lt: toInstant }, ...postRel }, _count: { _all: true } }),
    prisma.blogPostViewLog.groupBy({ by: ["device"], where: { createdAt: { gte: logsFrom, lt: toInstant }, ...postRel }, _count: { _all: true } }),
  ]);

  // Series = aggregated days (BlogPostDailyStat) + today's (and any other) unprocessed logs; totals are summed from it.
  const rows: DayRow[] = [...dailyByDay.map((r) => ({ day: dayKeyOf(r.day), views: r._sum.views ?? 0, visitors: r._sum.visitors ?? 0 })), ...liveDayRows(unprocessed)];
  const series = buildSeries(p, rows, publishedPosts.map((x) => spDayKey(x.publishDate!)));
  const live = { byPost: viewsByPostOf(unprocessed) };

  const viewsByPost = new Map<string, number>(dailyByPost.map((r) => [r.postId, r._sum.views ?? 0]));
  for (const [postId, n] of live.byPost) viewsByPost.set(postId, (viewsByPost.get(postId) ?? 0) + n);

  const topIds = Array.from(viewsByPost.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);
  const [topRows, cats] = await Promise.all([
    topIds.length ? prisma.blogPost.findMany({ where: { id: { in: topIds }, deletedAt: null }, select: { id: true, title: true, slug: true, heartsCount: true, commentsCount: true } }) : [],
    viewsByPost.size ? prisma.blogPostCategory.findMany({ where: { postId: { in: Array.from(viewsByPost.keys()) }, post: { deletedAt: null } }, select: { postId: true, category: { select: { id: true, name: true } } } }) : [],
  ]);
  const topById = new Map(topRows.map((r) => [r.id, r]));
  const topPosts = topIds
    .map((id) => topById.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ id: r.id, title: r.title, slug: r.slug, views: viewsByPost.get(r.id) ?? 0, hearts: r.heartsCount, comments: r.commentsCount }));

  const catMap = new Map<string, { id: string; name: string; views: number }>();
  for (const c of cats) {
    const e = catMap.get(c.category.id) ?? { id: c.category.id, name: c.category.name, views: 0 };
    e.views += viewsByPost.get(c.postId) ?? 0;
    catMap.set(c.category.id, e);
  }
  const byCategory = Array.from(catMap.values()).sort((a, b) => b.views - a.views);

  const referrers = refRows
    .map((r) => ({ host: r.referrerHost ?? "Direto", views: r._count._all }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);
  const devices = devRows.map((r) => ({ device: r.device ?? "desconhecido", views: r._count._all })).sort((a, b) => b.views - a.views);

  const totals = {
    views: series.reduce((s, x) => s + x.views, 0),
    visitors: series.reduce((s, x) => s + x.visitors, 0),
    hearts,
    comments,
    published: publishedPosts.length,
  };
  return { period: { from: p.from, to: p.to, granularity: p.granularity }, totals, series, topPosts, byCategory, referrers, devices };
}
