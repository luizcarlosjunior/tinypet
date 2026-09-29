import { prisma } from "@tinypet/db";
import { revalidatePath } from "next/cache";
import { addDays, dateOnly, spDayKey, spDayStart } from "./utils";

const BATCH_SIZE = 500;
const MAX_BATCHES = 20;
const RETENTION_DAYS = 90;
const PRUNE_LIMIT = 5000;

async function distinctVisitors(postId: string, from: Date, to: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint | number }[]>`SELECT COUNT(DISTINCT visitor_hash) AS n FROM blog_post_view_logs WHERE post_id = ${postId} AND created_at >= ${from} AND created_at < ${to}`;
  return Number(rows[0]?.n ?? 0);
}

/** Rolling windows from the raw logs (kept 90 days): last 7 days and current SP calendar month. */
async function refreshWindows(postIds: string[], now: Date) {
  const today = spDayKey(now);
  const sevenDaysAgo = spDayStart(addDays(today, -6));
  const monthStart = spDayStart(`${today.slice(0, 7)}-01`);
  for (const postId of postIds) {
    const [viewsLast7Days, viewsThisMonth] = await Promise.all([
      prisma.blogPostViewLog.count({ where: { postId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.blogPostViewLog.count({ where: { postId, createdAt: { gte: monthStart } } }),
    ]);
    await prisma.blogPost.update({ where: { id: postId }, data: { viewsLast7Days, viewsThisMonth } }).catch(() => undefined);
  }
}

/**
 * Processes unprocessed view logs: BlogPost.views += n, BlogPostDailyStat (views / distinct visitors per SP day,
 * recomputed from the logs of that day), rolling 7-day / month counters; prunes processed logs older than 90 days.
 */
export async function jobBlogViews(now = new Date()) {
  let processed = 0;
  const touchedPosts = new Set<string>();
  for (let i = 0; i < MAX_BATCHES; i++) {
    const logs = await prisma.blogPostViewLog.findMany({ where: { processed: false }, select: { id: true, postId: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: BATCH_SIZE });
    if (!logs.length) break;
    const perPost = new Map<string, number>();
    const days = new Map<string, { postId: string; day: string }>();
    for (const l of logs) {
      perPost.set(l.postId, (perPost.get(l.postId) ?? 0) + 1);
      const day = spDayKey(l.createdAt);
      days.set(`${l.postId}|${day}`, { postId: l.postId, day });
    }
    // Mark first so a crash never double-counts views (daily stats are recomputed from the logs anyway).
    await prisma.blogPostViewLog.updateMany({ where: { id: { in: logs.map((l) => l.id) } }, data: { processed: true } });
    for (const [postId, n] of perPost) {
      await prisma.blogPost.update({ where: { id: postId }, data: { views: { increment: n } } }).catch(() => undefined);
      touchedPosts.add(postId);
    }
    for (const { postId, day } of days.values()) {
      const from = spDayStart(day);
      const to = spDayStart(addDays(day, 1));
      const [views, visitors] = await Promise.all([prisma.blogPostViewLog.count({ where: { postId, createdAt: { gte: from, lt: to } } }), distinctVisitors(postId, from, to)]);
      await prisma.blogPostDailyStat.upsert({
        where: { postId_day: { postId, day: dateOnly(day) } },
        create: { postId, day: dateOnly(day), views, visitors },
        update: { views, visitors },
      });
    }
    processed += logs.length;
    if (logs.length < BATCH_SIZE) break;
  }
  // Windows decay even without new views: refresh posts that still show a non-zero window.
  const stale = await prisma.blogPost.findMany({ where: { OR: [{ viewsLast7Days: { gt: 0 } }, { viewsThisMonth: { gt: 0 } }], id: { notIn: Array.from(touchedPosts) } }, select: { id: true }, take: 2000 });
  await refreshWindows([...touchedPosts, ...stale.map((s) => s.id)], now);

  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000);
  let pruned = 0;
  try {
    pruned = await prisma.$executeRaw`DELETE FROM blog_post_view_logs WHERE processed = 1 AND created_at < ${cutoff} LIMIT ${PRUNE_LIMIT}`;
  } catch (e) {
    console.error("[blog-views] prune failed", e);
  }
  return { processed, posts: touchedPosts.size, pruned };
}

/** SCHEDULED posts whose publishDate is due → PUBLISHED. */
export async function jobBlogPublishScheduled(now = new Date()) {
  const due = await prisma.blogPost.findMany({ where: { status: "SCHEDULED", publishDate: { lte: now }, deletedAt: null }, select: { id: true, slug: true } });
  if (!due.length) return { published: 0 };
  const r = await prisma.blogPost.updateMany({ where: { id: { in: due.map((d) => d.id) }, status: "SCHEDULED" }, data: { status: "PUBLISHED" } });
  try {
    revalidatePath("/blog");
    for (const d of due) revalidatePath(`/blog/${d.slug}`);
    revalidatePath("/sitemap.xml");
  } catch {
    /* outside a request context */
  }
  return { published: r.count, slugs: due.map((d) => d.slug) };
}
