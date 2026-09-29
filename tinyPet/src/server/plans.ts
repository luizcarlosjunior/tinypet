import { prisma } from "@/db";
import { Errors } from "./errors";

export type Audience = "OWNER" | "PARTNER";
export type Limits = Record<string, { enabled: boolean; quantity: number | null }>;

export async function ensureDefaultSubscription(audience: Audience, id: string) {
  const plan = await prisma.plan.findFirst({ where: { audience, isDefault: true } });
  if (!plan) return;
  if (audience === "OWNER") {
    await prisma.subscription.upsert({ where: { userId: id }, update: {}, create: { userId: id, planId: plan.id, status: "ACTIVE", startsAt: new Date() } });
  } else {
    await prisma.subscription.upsert({ where: { partnerId: id }, update: {}, create: { partnerId: id, planId: plan.id, status: "ACTIVE", startsAt: new Date() } });
    await prisma.partner.update({ where: { id }, data: { plan: plan.key } });
  }
}

/** Effective limits = plan limits + add-ons. */
export async function getLimits(audience: Audience, id: string): Promise<{ planKey: string; limits: Limits }> {
  const sub = await prisma.subscription.findFirst({
    where: audience === "OWNER" ? { userId: id } : { partnerId: id },
    include: { plan: { include: { limits: true } }, addOns: { include: { addOn: true } } },
  });
  let plan = sub?.plan;
  if (!plan || (sub && ["CANCELED"].includes(sub.status))) {
    plan = (await prisma.plan.findFirst({ where: { audience, isDefault: true }, include: { limits: true } })) ?? plan;
  }
  const limits: Limits = {};
  for (const l of plan?.limits ?? []) limits[l.featureKey] = { enabled: l.enabled, quantity: l.quantity };
  for (const a of sub?.addOns ?? []) {
    const cur = limits[a.addOn.featureKey] ?? { enabled: true, quantity: 0 };
    if (cur.quantity != null) cur.quantity += a.addOn.quantity * a.quantity;
    limits[a.addOn.featureKey] = cur;
  }
  return { planKey: plan?.key ?? "free", limits };
}

export async function hasFeature(audience: Audience, id: string, featureKey: string): Promise<boolean> {
  const { limits } = await getLimits(audience, id);
  const l = limits[featureKey];
  return l ? l.enabled : false;
}

/** Throws PLAN_LIMIT (402) when `current` already reached the plan quantity. */
export async function assertLimit(audience: Audience, id: string, featureKey: string, current: number) {
  const { planKey, limits } = await getLimits(audience, id);
  const l = limits[featureKey];
  if (!l) return; // unknown feature => not limited
  if (!l.enabled) throw Errors.planLimit({ featureKey, current, limit: 0, planKey });
  if (l.quantity != null && current >= l.quantity) throw Errors.planLimit({ featureKey, current, limit: l.quantity, planKey });
}

export async function assertFeature(audience: Audience, id: string, featureKey: string) {
  const { planKey, limits } = await getLimits(audience, id);
  const l = limits[featureKey];
  if (l && !l.enabled) throw Errors.planLimit({ featureKey, current: 0, limit: 0, planKey });
}

/** Usage summary for the "plan" screen. */
export async function partnerUsage(partnerId: string) {
  const [catalog, clients, team, contracts, courses, storage] = await Promise.all([
    prisma.catalogItem.count({ where: { partnerId, deletedAt: null } }),
    prisma.client.count({ where: { partnerId, deletedAt: null } }),
    prisma.membership.count({ where: { partnerId } }),
    prisma.contract.count({ where: { partnerId, status: "ACTIVE" } }),
    prisma.course.count({ where: { partnerId, status: { not: "ARCHIVED" } } }),
    prisma.mediaAsset.aggregate({ where: { partnerId }, _sum: { sizeBytes: true } }),
  ]);
  const { planKey, limits } = await getLimits("PARTNER", partnerId);
  return {
    planKey,
    limits,
    usage: {
      catalog_items: catalog,
      crm_clients: clients,
      team_members: team,
      active_contracts: contracts,
      courses,
      storage_mb: Math.round((storage._sum.sizeBytes ?? 0) / 1024 / 1024),
    },
  };
}

export async function ownerUsage(userId: string) {
  const [pets, storage] = await Promise.all([
    prisma.pet.count({ where: { ownerId: userId, deletedAt: null, status: "ACTIVE", createdByPartnerId: null } }),
    prisma.mediaAsset.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
  ]);
  const { planKey, limits } = await getLimits("OWNER", userId);
  return { planKey, limits, usage: { owner_pets: pets, owner_storage_mb: Math.round((storage._sum.sizeBytes ?? 0) / 1024 / 1024) } };
}
