/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, Prisma } from "@/db";
import { handler, ok, parseBody, serialize } from "./api";
import { requireAdmin } from "./auth";
import { Errors } from "./errors";

/*
 * Generic admin CRUD factory: GET (list) / POST (create) on the collection and GET / PATCH / DELETE on an item.
 * Every handler enforces `requireAdmin(req)`. FK violations on delete become 409.
 */

type Mode = "create" | "update";

export type CrudOptions<S extends z.ZodObject<any>> = {
  include?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Record<string, unknown>[];
  /** Optional list filter built from the query string (e.g. `?speciesId=` or `?q=`). */
  listWhere?: (params: URLSearchParams) => Record<string, unknown>;
  /** Transforms the validated body into Prisma data (e.g. resolve `speciesKey` → `speciesId`). */
  transform?: (body: z.infer<S> | Partial<z.infer<S>>, mode: Mode, id?: string) => Promise<Record<string, unknown>> | Record<string, unknown>;
};

export function crudRoutes<S extends z.ZodObject<any>>(model: keyof typeof prisma & string, schema: S, opts: CrudOptions<S> = {}) {
  const db = () => (prisma as any)[model];
  const include = opts.include;
  const orderBy = opts.orderBy;

  const list = handler(async (req: NextRequest) => {
    await requireAdmin(req);
    const where = opts.listWhere ? opts.listWhere(req.nextUrl.searchParams) : undefined;
    const items = await db().findMany({ where, include, orderBy });
    return ok(serialize(items));
  });

  const create = handler(async (req: NextRequest) => {
    await requireAdmin(req);
    const body = await parseBody(req, schema);
    const data = opts.transform ? await opts.transform(body, "create") : body;
    const row = await db().create({ data, include });
    return ok(serialize(row), { status: 201 });
  });

  const get = handler<{ id: string }>(async (req, { params }) => {
    await requireAdmin(req);
    const row = await db().findUnique({ where: { id: params.id }, include });
    if (!row) throw Errors.notFound();
    return ok(serialize(row));
  });

  const update = handler<{ id: string }>(async (req, { params }) => {
    await requireAdmin(req);
    const body = await parseBody(req, schema.partial());
    const data = opts.transform ? await opts.transform(body, "update", params.id) : body;
    const row = await db().update({ where: { id: params.id }, data, include });
    return ok(serialize(row));
  });

  const remove = handler<{ id: string }>(async (req, { params }) => {
    await requireAdmin(req);
    try {
      await db().delete({ where: { id: params.id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") throw Errors.conflict("Registro em uso; não pode ser removido");
      throw e;
    }
    return ok({ deleted: true });
  });

  return { list, create, get, update, remove };
}

/** Resolves a species key (e.g. "dog") to its id; throws 404 when unknown. */
export async function speciesIdFromKey(key: string | null | undefined) {
  if (!key) return null;
  const s = await prisma.species.findUnique({ where: { key }, select: { id: true } });
  if (!s) throw Errors.notFound("Espécie não encontrada");
  return s.id;
}

/** Ensures a subscription for a user or partner on the given plan key (admin assignment). */
export async function assignPlan(audience: "OWNER" | "PARTNER", id: string, planKey: string) {
  const plan = await prisma.plan.findUnique({ where: { key: planKey } });
  if (!plan) throw Errors.notFound("Plano não encontrado");
  if (plan.audience !== audience) throw Errors.badRequest(`O plano ${planKey} não é para ${audience === "OWNER" ? "tutores" : "parceiros"}`);
  if (audience === "OWNER") {
    await prisma.subscription.upsert({ where: { userId: id }, update: { planId: plan.id, status: "ACTIVE" }, create: { userId: id, planId: plan.id, status: "ACTIVE", startsAt: new Date() } });
  } else {
    await prisma.subscription.upsert({ where: { partnerId: id }, update: { planId: plan.id, status: "ACTIVE" }, create: { partnerId: id, planId: plan.id, status: "ACTIVE", startsAt: new Date() } });
    await prisma.partner.update({ where: { id }, data: { plan: plan.key } });
  }
  return plan;
}

export const planInclude = { limits: { include: { feature: { select: { key: true, label: true, kind: true, module: true } } } } } satisfies Prisma.PlanInclude;

export async function upsertPlanLimits(planId: string, limits: { featureKey: string; enabled: boolean; quantity?: number | null }[]) {
  await prisma.$transaction(
    limits.map((l) =>
      prisma.planFeatureLimit.upsert({
        where: { planId_featureKey: { planId, featureKey: l.featureKey } },
        update: { enabled: l.enabled, quantity: l.quantity ?? null },
        create: { planId, featureKey: l.featureKey, enabled: l.enabled, quantity: l.quantity ?? null },
      }),
    ),
  );
}

export const addOnSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  featureKey: z.string().min(1),
  quantity: z.number().int().min(1),
  priceMonthly: z.coerce.number().min(0).optional().nullable(),
});

export const settingSchema = z.object({ value: z.unknown() });
export const adminUserPatchSchema = z.object({ role: z.enum(["USER", "ADMIN", "EDITOR"]).optional(), planKey: z.string().min(1).optional() });
export const adminPartnerPatchSchema = z.object({ planKey: z.string().min(1).optional(), featured: z.boolean().optional(), published: z.boolean().optional() });
export const mediaModerationSchema = z.object({ action: z.enum(["APPROVE", "REJECT"]) });

/** Include for report moderation listings. */
export const reportInclude = {
  reporter: { select: { id: true, name: true, email: true } },
  review: { include: { user: { select: { id: true, name: true } }, partner: { select: { id: true, tradeName: true, slug: true } }, item: { select: { id: true, name: true } }, course: { select: { id: true, title: true } } } },
} satisfies Prisma.ReportInclude;

/** CRUD options for skills: `speciesKey` in the body is resolved to `speciesId`. */
export const skillCrudOptions = {
  include: { species: { select: { id: true, key: true, label: true } } },
  orderBy: { name: "asc" as const },
  listWhere: (p: URLSearchParams) => ({ ...(p.get("custom") ? { isCustom: p.get("custom") === "true" } : {}), ...(p.get("q") ? { name: { contains: p.get("q")! } } : {}) }),
  transform: async (b: { speciesKey?: string | null; name?: string; key?: string }) => ({
    ...(b.name !== undefined ? { name: b.name } : {}),
    ...(b.key !== undefined ? { key: b.key } : {}),
    ...(b.speciesKey !== undefined ? { speciesId: await speciesIdFromKey(b.speciesKey) } : {}),
  }),
};
