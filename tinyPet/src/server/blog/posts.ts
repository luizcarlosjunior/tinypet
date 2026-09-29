import { z } from "zod";
import { prisma, type Prisma, type BlogPostStatus } from "@/db";
import { Errors } from "../errors";
import { paginate } from "../api";
import { blogMediaBases, sanitizeBlogHtml } from "./auth";
import { isOurMediaUrl } from "./sanitize";
import { categoryIdsForSlug } from "./categories";
import {
  BLOG_SLUG_MAX,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  SUMMARY_MAX,
  blogSlugify,
  deletedSlug,
  excerpt,
  normalizeTags,
  readingMinutes,
  shouldCreateRedirect,
  tagsFromString,
  tagsToString,
  uniqueSlug,
} from "./utils";

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const mediaUrl = z.string().trim().max(1000).optional().nullable();

export const postBodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().max(BLOG_SLUG_MAX).optional().nullable(),
  summary: optionalText(SUMMARY_MAX),
  content: z.string().max(2_000_000),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
  publishDate: z.coerce.date().optional().nullable(),
  categoryIds: z.array(z.string().min(1)).max(20).default([]),
  tags: z.array(z.string().max(60)).max(40).optional().nullable(),
  coverImageRect: mediaUrl,
  coverImageSquare: mediaUrl,
  coverOgImage: mediaUrl,
  coverAlt: optionalText(300),
  seoTitle: optionalText(SEO_TITLE_MAX),
  seoDescription: optionalText(SEO_DESCRIPTION_MAX),
  featured: z.boolean().optional(),
  commentsEnabled: z.boolean().optional(),
});
export const postPatchSchema = postBodySchema.partial();
export type PostBody = z.infer<typeof postBodySchema>;

export const adminPostListSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
  categoryId: z.string().optional(),
  authorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const publicPostListSchema = z.object({
  category: z.string().trim().max(140).optional(),
  tag: z.string().trim().max(60).optional(),
  q: z.string().trim().max(200).optional(),
  featured: z.enum(["0", "1", "true", "false"]).optional(),
  exclude: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

/** Published and visible to readers now. */
export function publishedWhere(now = new Date()): Prisma.BlogPostWhereInput {
  return { status: "PUBLISHED", publishDate: { lte: now }, deletedAt: null };
}

const COVER_FIELDS = ["coverImageRect", "coverImageSquare", "coverOgImage"] as const;

async function slugTaken(slug: string, exceptPostId?: string) {
  const [post, redirect] = await Promise.all([
    prisma.blogPost.findFirst({ where: { slug, ...(exceptPostId ? { id: { not: exceptPostId } } : {}) }, select: { id: true } }),
    prisma.blogSlugRedirect.findFirst({ where: { oldSlug: slug, ...(exceptPostId ? { postId: { not: exceptPostId } } : {}) }, select: { id: true } }),
  ]);
  return !!post || !!redirect;
}

async function resolvePostSlug(input: { slug?: string | null; title: string }, exceptPostId?: string) {
  if (input.slug) {
    const s = blogSlugify(input.slug);
    if (!s) throw Errors.badRequest("Slug inválido");
    if (await slugTaken(s, exceptPostId)) throw Errors.conflict("Já existe um post com este slug");
    return s;
  }
  return uniqueSlug(blogSlugify(input.title), (s) => slugTaken(s, exceptPostId));
}

function assertMediaUrls(b: Partial<PostBody>) {
  const bases = blogMediaBases();
  for (const f of COVER_FIELDS) {
    const v = b[f];
    if (v && !isOurMediaUrl(v, bases)) throw Errors.badRequest("A imagem de capa deve ser enviada pela biblioteca de mídia do blog", { field: f });
  }
}

async function assertCategories(ids: string[]) {
  if (!ids.length) return;
  const n = await prisma.blogCategory.count({ where: { id: { in: ids } } });
  if (n !== new Set(ids).size) throw Errors.badRequest("Categoria inválida");
}

/** Status/publishDate rules: SCHEDULED needs a future date; PUBLISHED without a date publishes now. */
export function resolvePublication(status: BlogPostStatus, publishDate: Date | null | undefined, now = new Date()): Date | null {
  if (status === "SCHEDULED") {
    if (!publishDate || publishDate.getTime() <= now.getTime()) throw Errors.badRequest("Agendamento exige uma data de publicação futura", { field: "publishDate" });
    return publishDate;
  }
  if (status === "PUBLISHED") return publishDate ?? now;
  return publishDate ?? null;
}

function cleanNullable(v: string | null | undefined) {
  return v ? v : null;
}

export async function createPost(input: PostBody, authorId: string) {
  assertMediaUrls(input);
  const categoryIds = Array.from(new Set(input.categoryIds));
  await assertCategories(categoryIds);
  const content = sanitizeBlogHtml(input.content);
  const slug = await resolvePostSlug({ slug: input.slug, title: input.title });
  const publishDate = resolvePublication(input.status, input.publishDate);
  const post = await prisma.blogPost.create({
    data: {
      title: input.title,
      slug,
      summary: cleanNullable(input.summary),
      content,
      status: input.status,
      publishDate,
      authorId,
      coverImageRect: cleanNullable(input.coverImageRect),
      coverImageSquare: cleanNullable(input.coverImageSquare),
      coverOgImage: cleanNullable(input.coverOgImage),
      coverAlt: cleanNullable(input.coverAlt),
      seoTitle: cleanNullable(input.seoTitle),
      seoDescription: cleanNullable(input.seoDescription),
      tags: tagsToString(normalizeTags(input.tags)),
      readingMinutes: readingMinutes(content),
      featured: input.featured ?? false,
      commentsEnabled: input.commentsEnabled ?? true,
      categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
    },
    select: { id: true },
  });
  return getAdminPost(post.id);
}

export async function updatePost(id: string, input: z.infer<typeof postPatchSchema>) {
  const cur = await prisma.blogPost.findFirst({ where: { id, deletedAt: null } });
  if (!cur) throw Errors.notFound("Post não encontrado");
  assertMediaUrls(input);
  const data: Prisma.BlogPostUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  let newSlug = cur.slug;
  if (input.slug !== undefined && input.slug && blogSlugify(input.slug) !== cur.slug) newSlug = await resolvePostSlug({ slug: input.slug, title: input.title ?? cur.title }, id);
  data.slug = newSlug;
  if (input.summary !== undefined) data.summary = cleanNullable(input.summary);
  if (input.content !== undefined) {
    const content = sanitizeBlogHtml(input.content);
    data.content = content;
    data.readingMinutes = readingMinutes(content);
  }
  const status = input.status ?? cur.status;
  const publishDate = input.publishDate !== undefined ? input.publishDate : cur.publishDate;
  if (input.status !== undefined || input.publishDate !== undefined) {
    data.status = status;
    data.publishDate = resolvePublication(status, publishDate);
  }
  for (const f of COVER_FIELDS) if (input[f] !== undefined) data[f] = cleanNullable(input[f]);
  if (input.coverAlt !== undefined) data.coverAlt = cleanNullable(input.coverAlt);
  if (input.seoTitle !== undefined) data.seoTitle = cleanNullable(input.seoTitle);
  if (input.seoDescription !== undefined) data.seoDescription = cleanNullable(input.seoDescription);
  if (input.tags !== undefined) data.tags = tagsToString(normalizeTags(input.tags));
  if (input.featured !== undefined) data.featured = input.featured;
  if (input.commentsEnabled !== undefined) data.commentsEnabled = input.commentsEnabled;

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (input.categoryIds !== undefined) {
    const categoryIds = Array.from(new Set(input.categoryIds));
    await assertCategories(categoryIds);
    ops.push(prisma.blogPostCategory.deleteMany({ where: { postId: id } }));
    if (categoryIds.length) ops.push(prisma.blogPostCategory.createMany({ data: categoryIds.map((categoryId) => ({ postId: id, categoryId })) }));
  }
  if (shouldCreateRedirect({ oldSlug: cur.slug, newSlug, previousStatus: cur.status })) {
    ops.push(prisma.blogSlugRedirect.deleteMany({ where: { oldSlug: cur.slug } }));
    ops.push(prisma.blogSlugRedirect.create({ data: { oldSlug: cur.slug, postId: id } }));
  }
  // The post takes its own old slug back: drop the now-shadowed redirect.
  if (newSlug !== cur.slug) ops.push(prisma.blogSlugRedirect.deleteMany({ where: { oldSlug: newSlug, postId: id } }));
  ops.push(prisma.blogPost.update({ where: { id }, data }));
  await prisma.$transaction(ops);
  return { post: await getAdminPost(id), previousSlug: cur.slug };
}

export async function softDeletePost(id: string) {
  const cur = await prisma.blogPost.findFirst({ where: { id, deletedAt: null }, select: { id: true, slug: true } });
  if (!cur) throw Errors.notFound("Post não encontrado");
  // Release the slug (and old slugs) so a new post can use them; the deleted post keeps a unique placeholder.
  await prisma.$transaction([
    prisma.blogSlugRedirect.deleteMany({ where: { postId: id } }),
    prisma.blogPost.update({ where: { id }, data: { deletedAt: new Date(), slug: deletedSlug(cur.slug, id) } }),
  ]);
  return cur;
}

const adminListSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  publishDate: true,
  featured: true,
  views: true,
  heartsCount: true,
  commentsCount: true,
  coverImageRect: true,
  updatedAt: true,
  createdAt: true,
  author: { select: { id: true, name: true } },
  categories: { select: { category: { select: { id: true, name: true, parentId: true } } } },
} satisfies Prisma.BlogPostSelect;

export async function listAdminPosts(q: z.infer<typeof adminPostListSchema>) {
  const where: Prisma.BlogPostWhereInput = {
    deletedAt: null,
    ...(q.status ? { status: q.status } : {}),
    ...(q.authorId ? { authorId: q.authorId } : {}),
    ...(q.categoryId ? { categories: { some: { OR: [{ categoryId: q.categoryId }, { category: { parentId: q.categoryId } }] } } } : {}),
    ...(q.q ? { OR: [{ title: { contains: q.q } }, { slug: { contains: q.q } }, { summary: { contains: q.q } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({ where, select: adminListSelect, orderBy: [{ updatedAt: "desc" }], ...paginate(q.page, q.pageSize) }),
  ]);
  return { items: rows.map((r) => ({ ...r, categories: r.categories.map((c) => c.category) })), meta: { page: q.page, pageSize: q.pageSize, total } };
}

export async function getAdminPost(id: string) {
  const p = await prisma.blogPost.findFirst({
    where: { id, deletedAt: null },
    include: { author: { select: { id: true, name: true } }, categories: { select: { category: { select: { id: true, name: true, slug: true, parentId: true } } } } },
  });
  if (!p) throw Errors.notFound("Post não encontrado");
  const { categories, tags, ...rest } = p;
  return { ...rest, tags: tagsFromString(tags), categories: categories.map((c) => c.category), categoryIds: categories.map((c) => c.category.id) };
}

// ───────────────────────────── public ─────────────────────────────

const publicListSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  content: true,
  coverImageRect: true,
  coverImageSquare: true,
  coverAlt: true,
  publishDate: true,
  readingMinutes: true,
  featured: true,
  heartsCount: true,
  commentsCount: true,
  author: { select: { name: true } },
  categories: { select: { category: { select: { name: true, slug: true, active: true } } } },
} satisfies Prisma.BlogPostSelect;

type PublicListRow = Prisma.BlogPostGetPayload<{ select: typeof publicListSelect }>;

export type PublicPostItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImageRect: string | null;
  coverImageSquare: string | null;
  coverAlt: string | null;
  publishDate: Date | null;
  readingMinutes: number;
  featured: boolean;
  categories: { name: string; slug: string }[];
  author: { name: string } | null;
  heartsCount: number;
  commentsCount: number;
};

function toPublicItem(r: PublicListRow): PublicPostItem {
  const { content, categories, ...rest } = r;
  return {
    ...rest,
    summary: r.summary || excerpt(content, 200),
    categories: categories.filter((c) => c.category.active).map((c) => ({ name: c.category.name, slug: c.category.slug })),
  };
}

/** Escapes LIKE wildcards is not needed: Prisma `contains` escapes them. Exact tag match on the comma-separated column. */
function tagWhere(tag: string): Prisma.BlogPostWhereInput {
  return { OR: [{ tags: tag }, { tags: { startsWith: `${tag},` } }, { tags: { endsWith: `,${tag}` } }, { tags: { contains: `,${tag},` } }] };
}

export async function listPublicPosts(q: z.infer<typeof publicPostListSchema>) {
  const and: Prisma.BlogPostWhereInput[] = [publishedWhere()];
  let category: Awaited<ReturnType<typeof categoryIdsForSlug>> = null;
  if (q.category) {
    category = await categoryIdsForSlug(q.category);
    if (!category) return { items: [] as PublicPostItem[], meta: { page: q.page, pageSize: q.pageSize, total: 0 }, category: null };
    and.push({ categories: { some: { categoryId: { in: category.ids } } } });
  }
  if (q.tag) and.push(tagWhere(q.tag.replace(/,/g, " ").trim()));
  if (q.q) and.push({ OR: [{ title: { contains: q.q } }, { summary: { contains: q.q } }, { tags: { contains: q.q } }] });
  if (q.featured === "1" || q.featured === "true") and.push({ featured: true });
  if (q.exclude) and.push({ id: { not: q.exclude } });
  const where: Prisma.BlogPostWhereInput = { AND: and };
  const [total, rows] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({ where, select: publicListSelect, orderBy: [{ publishDate: "desc" }, { id: "desc" }], ...paginate(q.page, q.pageSize) }),
  ]);
  return { items: rows.map(toPublicItem), meta: { page: q.page, pageSize: q.pageSize, total }, category: category?.category ?? null };
}

export type PublicPost = Awaited<ReturnType<typeof loadPublicPost>> & { viewerHearted: boolean };

async function loadPublicPost(where: Prisma.BlogPostWhereInput) {
  const p = await prisma.blogPost.findFirst({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      content: true,
      status: true,
      publishDate: true,
      updatedAt: true,
      createdAt: true,
      readingMinutes: true,
      coverImageRect: true,
      coverImageSquare: true,
      coverOgImage: true,
      coverAlt: true,
      seoTitle: true,
      seoDescription: true,
      tags: true,
      featured: true,
      commentsEnabled: true,
      heartsCount: true,
      commentsCount: true,
      views: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
      categories: { select: { category: { select: { id: true, name: true, slug: true, parentId: true, active: true } } } },
    },
  });
  if (!p) return null;
  const { categories, tags, content, ...rest } = p;
  return {
    ...rest,
    content: sanitizeBlogHtml(content, true),
    tags: tagsFromString(tags),
    categories: categories.filter((c) => c.category.active).map(({ category: c }) => ({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId })),
  };
}

/**
 * Published post by slug (or id). Old slug → `{ redirectTo }`. `preview` (blog editors only) shows any non-deleted post.
 */
export async function getPublicPost(slugOrId: string, opts: { viewerId?: string | null; preview?: boolean } = {}): Promise<{ post: PublicPost } | { redirectTo: string } | null> {
  const base: Prisma.BlogPostWhereInput = opts.preview ? { deletedAt: null } : publishedWhere();
  let post = await loadPublicPost({ ...base, slug: slugOrId });
  if (!post && /^c[a-z0-9]{20,30}$/.test(slugOrId)) post = await loadPublicPost({ ...base, id: slugOrId });
  if (!post) {
    const r = await prisma.blogSlugRedirect.findUnique({ where: { oldSlug: slugOrId }, select: { post: { select: { slug: true, status: true, publishDate: true, deletedAt: true } } } });
    const target = r?.post;
    if (target && !target.deletedAt && (opts.preview || (target.status === "PUBLISHED" && target.publishDate && target.publishDate <= new Date()))) return { redirectTo: target.slug };
    return null;
  }
  const viewerHearted = opts.viewerId ? !!(await prisma.blogPostHeart.findUnique({ where: { postId_userId: { postId: post.id, userId: opts.viewerId } }, select: { postId: true } })) : false;
  return { post: { ...post, viewerHearted } };
}

/** Up to `take` other published posts sharing a category (falls back to latest). */
export async function relatedPosts(postId: string, categoryIds: string[], take = 3) {
  const rows = categoryIds.length
    ? await prisma.blogPost.findMany({ where: { AND: [publishedWhere(), { id: { not: postId } }, { categories: { some: { categoryId: { in: categoryIds } } } }] }, select: publicListSelect, orderBy: { publishDate: "desc" }, take })
    : [];
  if (rows.length < take) {
    const more = await prisma.blogPost.findMany({ where: { AND: [publishedWhere(), { id: { notIn: [postId, ...rows.map((r) => r.id)] } }] }, select: publicListSelect, orderBy: { publishDate: "desc" }, take: take - rows.length });
    rows.push(...more);
  }
  return rows.map(toPublicItem);
}

/** A post readers can interact with (hearts/comments/views): published and visible now. */
export async function findPublishedPost(id: string) {
  return prisma.blogPost.findFirst({ where: { ...publishedWhere(), id }, select: { id: true, slug: true, title: true, commentsEnabled: true } });
}
