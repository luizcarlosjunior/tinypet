import { prisma, Prisma } from "@/db";
import type { CatalogItemInput } from "@tinypet/shared";
import { CATALOG_MEDIA_MAX } from "@tinypet/shared";
import { Errors } from "./errors";
import { assertLimit } from "./plans";

export type CatalogMediaInput = { kind: "IMAGE" | "VIDEO"; url: string; thumbUrl?: string | null; isCover?: boolean; sortOrder?: number };

export const catalogInclude = {
  category: { select: { id: true, key: true, label: true } },
  subcategory: { select: { id: true, key: true, label: true } },
  brand: { select: { id: true, name: true } },
  productLine: { select: { id: true, name: true } },
  media: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.CatalogItemInclude;

/** Validates category/subcategory/brand/line consistency and promo price. */
async function validateItem(input: Partial<CatalogItemInput>, current?: { categoryId: string; price: Prisma.Decimal | null; promoPrice: Prisma.Decimal | null; brandId: string | null }) {
  const categoryId = input.categoryId ?? current?.categoryId;
  if (input.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: input.categoryId, active: true } });
    if (!cat) throw Errors.badRequest("Categoria inválida");
  }
  if (input.subcategoryId) {
    const sub = await prisma.subcategory.findFirst({ where: { id: input.subcategoryId, active: true } });
    if (!sub || sub.categoryId !== categoryId) throw Errors.badRequest("Subcategoria não pertence à categoria escolhida");
  }
  const brandId = input.brandId !== undefined ? input.brandId : current?.brandId ?? null;
  if (input.brandId) {
    const brand = await prisma.brand.findFirst({ where: { id: input.brandId, status: "APPROVED" } });
    if (!brand) throw Errors.badRequest("Marca inválida");
  }
  if (input.productLineId) {
    const line = await prisma.productLine.findFirst({ where: { id: input.productLineId } });
    if (!line || (brandId && line.brandId !== brandId)) throw Errors.badRequest("Linha não pertence à marca escolhida");
  }
  const price = input.price !== undefined ? input.price : current?.price != null ? Number(current.price) : null;
  const promo = input.promoPrice !== undefined ? input.promoPrice : current?.promoPrice != null ? Number(current.promoPrice) : null;
  if (promo != null) {
    if (price == null) throw Errors.badRequest("Informe o preço para definir um preço promocional");
    if (promo >= price) throw Errors.badRequest("O preço promocional deve ser menor que o preço");
  }
  if (input.media && input.media.length > CATALOG_MEDIA_MAX) throw Errors.badRequest(`Máximo de ${CATALOG_MEDIA_MAX} mídias por item`);
}

function mediaCreate(media: CatalogMediaInput[]) {
  const hasCover = media.some((m) => m.isCover);
  return media.map((m, i) => ({ kind: m.kind, url: m.url, thumbUrl: m.thumbUrl ?? null, isCover: hasCover ? !!m.isCover : i === 0, sortOrder: m.sortOrder ?? i }));
}

export async function listCatalog(partnerId: string, q: { status?: "DRAFT" | "PUBLISHED" | "PAUSED"; type?: "PRODUCT" | "SERVICE"; q?: string; page: number; pageSize: number }) {
  const where: Prisma.CatalogItemWhereInput = {
    partnerId,
    deletedAt: null,
    ...(q.status ? { status: q.status } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q } }, { description: { contains: q.q } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.catalogItem.findMany({ where, include: catalogInclude, orderBy: [{ status: "asc" }, { name: "asc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.catalogItem.count({ where }),
  ]);
  return { items, total };
}

export async function getCatalogItem(partnerId: string, id: string) {
  const item = await prisma.catalogItem.findFirst({ where: { id, partnerId, deletedAt: null }, include: catalogInclude });
  if (!item) throw Errors.notFound("Item não encontrado");
  return item;
}

export async function createCatalogItem(partnerId: string, input: CatalogItemInput) {
  await assertLimit("PARTNER", partnerId, "catalog_items", await prisma.catalogItem.count({ where: { partnerId, deletedAt: null } }));
  await validateItem(input);
  const { media, ...rest } = input;
  return prisma.catalogItem.create({
    data: {
      partnerId,
      type: rest.type,
      name: rest.name,
      description: rest.description ?? null,
      categoryId: rest.categoryId,
      subcategoryId: rest.subcategoryId ?? null,
      price: rest.price ?? null,
      promoPrice: rest.promoPrice ?? null,
      promoUntil: rest.promoUntil ? new Date(rest.promoUntil) : null,
      durationMinutes: rest.durationMinutes ?? null,
      serviceLocations: rest.serviceLocations ?? undefined,
      defaultLocation: rest.defaultLocation ?? null,
      bookable: rest.bookable ?? false,
      speciesKeys: rest.speciesKeys ?? undefined,
      brandId: rest.brandId ?? null,
      productLineId: rest.productLineId ?? null,
      status: rest.status ?? "DRAFT",
      media: media?.length ? { create: mediaCreate(media) } : undefined,
    },
    include: catalogInclude,
  });
}

export async function updateCatalogItem(partnerId: string, id: string, input: Partial<CatalogItemInput>) {
  const current = await getCatalogItem(partnerId, id);
  await validateItem(input, current);
  const { media, ...rest } = input;
  const data: Prisma.CatalogItemUncheckedUpdateInput = {};
  if (rest.type !== undefined) data.type = rest.type;
  if (rest.name !== undefined) data.name = rest.name;
  if (rest.description !== undefined) data.description = rest.description;
  if (rest.categoryId !== undefined) data.categoryId = rest.categoryId;
  if (rest.subcategoryId !== undefined) data.subcategoryId = rest.subcategoryId;
  if (rest.price !== undefined) data.price = rest.price;
  if (rest.promoPrice !== undefined) data.promoPrice = rest.promoPrice;
  if (rest.promoUntil !== undefined) data.promoUntil = rest.promoUntil ? new Date(rest.promoUntil) : null;
  if (rest.durationMinutes !== undefined) data.durationMinutes = rest.durationMinutes;
  if (rest.serviceLocations !== undefined) data.serviceLocations = rest.serviceLocations;
  if (rest.defaultLocation !== undefined) data.defaultLocation = rest.defaultLocation;
  if (rest.bookable !== undefined) data.bookable = rest.bookable;
  if (rest.speciesKeys !== undefined) data.speciesKeys = rest.speciesKeys;
  if (rest.brandId !== undefined) data.brandId = rest.brandId;
  if (rest.productLineId !== undefined) data.productLineId = rest.productLineId;
  if (rest.status !== undefined) data.status = rest.status;
  if (media !== undefined) data.media = { deleteMany: {}, create: mediaCreate(media) };
  return prisma.catalogItem.update({ where: { id }, data, include: catalogInclude });
}

export async function replaceCatalogMedia(partnerId: string, id: string, media: CatalogMediaInput[]) {
  await getCatalogItem(partnerId, id);
  if (media.length > CATALOG_MEDIA_MAX) throw Errors.badRequest(`Máximo de ${CATALOG_MEDIA_MAX} mídias por item`);
  return prisma.catalogItem.update({ where: { id }, data: { media: { deleteMany: {}, create: mediaCreate(media) } }, include: catalogInclude });
}

export async function softDeleteCatalogItem(partnerId: string, id: string) {
  await getCatalogItem(partnerId, id);
  await prisma.catalogItem.update({ where: { id }, data: { deletedAt: new Date(), status: "PAUSED" } });
}
