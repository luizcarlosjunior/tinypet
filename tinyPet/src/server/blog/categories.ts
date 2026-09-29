import { z } from "zod";
import { prisma, type Prisma } from "@/db";
import { Errors } from "../errors";
import { blogSlugify, uniqueSlug } from "./utils";

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(140).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  parentId: z.string().min(1).optional().nullable(),
  sortOrder: z.coerce.number().int().min(-10000).max(10000).optional(),
  active: z.boolean().optional(),
});
export const categoryPatchSchema = categoryCreateSchema.partial();

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  parentId: string | null;
  postCount: number;
  children: CategoryNode[];
};

const PUBLISHED_WHERE = (now = new Date()): Prisma.BlogPostWhereInput => ({ status: "PUBLISHED", publishDate: { lte: now }, deletedAt: null });

/** Category tree (roots + children, ordered by sortOrder, name). `publicOnly`: active categories, published post counts. */
export async function categoryTree(opts: { publicOnly?: boolean } = {}): Promise<CategoryNode[]> {
  const postWhere: Prisma.BlogPostWhereInput = opts.publicOnly ? PUBLISHED_WHERE() : { deletedAt: null };
  const rows = await prisma.blogCategory.findMany({
    where: opts.publicOnly ? { active: true } : {},
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      active: true,
      parentId: true,
      _count: { select: { posts: { where: { post: postWhere } } } },
    },
  });
  const nodes = new Map<string, CategoryNode>(
    rows.map((r) => [r.id, { id: r.id, name: r.name, slug: r.slug, description: r.description, sortOrder: r.sortOrder, active: r.active, parentId: r.parentId, postCount: r._count.posts, children: [] }]),
  );
  const roots: CategoryNode[] = [];
  for (const n of nodes.values()) {
    if (n.parentId) {
      const parent = nodes.get(n.parentId);
      if (parent) parent.children.push(n);
      // inactive parent in public mode → its children are hidden too
    } else roots.push(n);
  }
  return roots;
}

async function slugTaken(slug: string, exceptId?: string) {
  const c = await prisma.blogCategory.findFirst({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  return !!c;
}

async function resolveSlug(input: { slug?: string | null; name: string }, exceptId?: string) {
  if (input.slug) {
    const s = blogSlugify(input.slug, 140);
    if (!s) throw Errors.badRequest("Slug inválido");
    if (await slugTaken(s, exceptId)) throw Errors.conflict("Já existe uma categoria com este slug");
    return s;
  }
  return uniqueSlug(blogSlugify(input.name, 130), (s) => slugTaken(s, exceptId));
}

/** Max depth 2: the parent must be a root category, and a category with children cannot become a subcategory. */
async function assertParent(parentId: string, selfId?: string) {
  if (selfId && parentId === selfId) throw Errors.badRequest("Uma categoria não pode ser pai dela mesma");
  const parent = await prisma.blogCategory.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } });
  if (!parent) throw Errors.badRequest("Categoria pai não encontrada");
  if (parent.parentId) throw Errors.badRequest("Subcategorias não podem ter subcategorias (máximo de 2 níveis)");
  if (selfId) {
    const children = await prisma.blogCategory.count({ where: { parentId: selfId } });
    if (children) throw Errors.badRequest("Esta categoria tem subcategorias e não pode virar subcategoria");
  }
}

export async function createCategory(input: z.infer<typeof categoryCreateSchema>) {
  if (input.parentId) await assertParent(input.parentId);
  const slug = await resolveSlug({ slug: input.slug, name: input.name });
  return prisma.blogCategory.create({
    data: { name: input.name, slug, description: input.description || null, parentId: input.parentId || null, sortOrder: input.sortOrder ?? 0, active: input.active ?? true },
  });
}

export async function updateCategory(id: string, input: z.infer<typeof categoryPatchSchema>) {
  const cur = await prisma.blogCategory.findUnique({ where: { id } });
  if (!cur) throw Errors.notFound("Categoria não encontrada");
  if (input.parentId) await assertParent(input.parentId, id);
  const data: Prisma.BlogCategoryUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined && input.slug) data.slug = await resolveSlug({ slug: input.slug, name: input.name ?? cur.name }, id);
  if (input.description !== undefined) data.description = input.description || null;
  if (input.parentId !== undefined) data.parentId = input.parentId || null;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.active !== undefined) data.active = input.active;
  return prisma.blogCategory.update({ where: { id }, data });
}

/** 409 when the category has subcategories, or posts unless `force` (then the posts are unlinked). */
export async function deleteCategory(id: string, force: boolean) {
  const cur = await prisma.blogCategory.findUnique({ where: { id }, select: { id: true, _count: { select: { children: true, posts: true } } } });
  if (!cur) throw Errors.notFound("Categoria não encontrada");
  if (cur._count.children) throw Errors.conflict("Remova ou mova as subcategorias antes de excluir esta categoria");
  if (cur._count.posts && !force) throw Errors.conflict(`Esta categoria tem ${cur._count.posts} post(s). Use force=1 para desvincular e excluir.`);
  await prisma.$transaction([prisma.blogPostCategory.deleteMany({ where: { categoryId: id } }), prisma.blogCategory.delete({ where: { id } })]);
  return { id, unlinkedPosts: cur._count.posts };
}

/** Category ids for a public category slug, including its subcategories. Null when unknown/inactive. */
export async function categoryIdsForSlug(slug: string) {
  const c = await prisma.blogCategory.findFirst({ where: { slug, active: true }, select: { id: true, name: true, slug: true, description: true, parentId: true, children: { where: { active: true }, select: { id: true } } } });
  if (!c) return null;
  if (c.parentId) {
    const parent = await prisma.blogCategory.findUnique({ where: { id: c.parentId }, select: { active: true } });
    if (!parent?.active) return null;
  }
  return { category: { id: c.id, name: c.name, slug: c.slug, description: c.description, parentId: c.parentId }, ids: [c.id, ...c.children.map((x) => x.id)] };
}
