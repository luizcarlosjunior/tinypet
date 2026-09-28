import { prisma, type Prisma, type ContractStatus, type InstallmentStatus, type Periodicity } from "@tinypet/db";
import { addDays, addMonths, formatBRL, INSTALLMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL, type ContractInput } from "@tinypet/shared";
import { Errors } from "./errors";
import { assertLimit } from "./plans";
import { audit } from "./audit";
import { notify, notifyPartner } from "./notify";
import { createAppointments, formatLocal, localDateStr } from "./scheduling";

/*
 * Finance domain: contracts, installments, payments, transactions, summary and CSV export.
 * Money math is done in integer cents; Prisma Decimal columns receive plain numbers.
 */

// ───────────────────────────── pure helpers ─────────────────────────────

export function toCents(v: number | string | { toString(): string } | null | undefined): number {
  if (v == null) return 0;
  return Math.round(Number(v.toString()) * 100);
}

export function fromCents(c: number): number {
  return Math.round(c) / 100;
}

export function contractTotals(items: { quantity: number; unitPrice: number | string }[], discount: number | string = 0) {
  const totalCents = items.reduce((sum, it) => sum + it.quantity * toCents(it.unitPrice), 0);
  const discountCents = Math.min(toCents(discount), totalCents);
  return { totalCents, discountCents, netCents: totalCents - discountCents };
}

/** Splits `netCents` evenly in `count` parts (cents); the last part absorbs rounding. */
export function splitInstallments(netCents: number, count: number): number[] {
  if (count < 1) throw Errors.badRequest("Número de parcelas inválido");
  const base = Math.round(netCents / count);
  const parts = Array.from({ length: count }, () => base);
  const sumOthers = base * (count - 1);
  parts[count - 1] = netCents - sumOthers;
  if (parts[count - 1]! < 0) {
    // tiny totals: fall back to floor split
    const floor = Math.floor(netCents / count);
    for (let i = 0; i < count; i++) parts[i] = floor;
    parts[count - 1] = netCents - floor * (count - 1);
  }
  return parts;
}

/** Date-only value (noon UTC so @db.Date keeps the calendar day regardless of server TZ). */
export function dateOnly(date: string): Date {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw Errors.badRequest("Data inválida");
  return d;
}

export function installmentDueDates(firstDueDate: string, periodicity: Periodicity, count: number): Date[] {
  const first = dateOnly(firstDueDate);
  return Array.from({ length: count }, (_, i) => (periodicity === "MONTHLY" ? addMonths(first, i) : addDays(first, i * (periodicity === "WEEKLY" ? 7 : 14))));
}

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function daysLate(dueDate: Date, now = new Date()): number {
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((today - due) / 86_400_000));
}

export function formatNumberBR(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace(".", ",");
}

export function formatDateBR(d: Date | null | undefined): string {
  if (!d) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** CSV with UTF-8 BOM, `;` separator and pt-BR decimals (Excel-friendly). */
export function toCsv(headers: string[], rows: (string | number | Date | null | undefined)[][]): string {
  const cell = (v: string | number | Date | null | undefined) => {
    if (v == null) return "";
    if (typeof v === "number") return formatNumberBR(v);
    if (v instanceof Date) return formatDateBR(v);
    const raw = String(v);
    // formula injection: text starting with = + - @ TAB CR is prefixed with ' (numbers are formatted above, untouched)
    const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

// ───────────────────────────── contracts ─────────────────────────────

export const contractInclude = {
  client: { select: { id: true, name: true, userId: true } },
  items: { include: { item: { select: { id: true, name: true } } } },
  pets: { include: { pet: { select: { id: true, name: true } } } },
  installments: { include: { payments: true }, orderBy: { number: "asc" as const } },
} satisfies Prisma.ContractInclude;

export type ContractRow = Prisma.ContractGetPayload<{ include: typeof contractInclude }>;

export function decorateContract(c: ContractRow) {
  const paidCents = c.installments.reduce((s, i) => s + toCents(i.paidAmount), 0);
  const netCents = toCents(c.totalAmount) - toCents(c.discount);
  return { ...c, pets: c.pets.map((p) => p.pet), netAmount: fromCents(netCents), paidAmount: fromCents(paidCents), balance: fromCents(netCents - paidCents) };
}

export async function listContracts(partnerId: string, q: { status?: ContractStatus; clientId?: string }) {
  const rows = await prisma.contract.findMany({ where: { partnerId, ...(q.status ? { status: q.status } : {}), ...(q.clientId ? { clientId: q.clientId } : {}) }, include: contractInclude, orderBy: { createdAt: "desc" } });
  return rows.map(decorateContract);
}

export async function getContract(partnerId: string, id: string) {
  const c = await prisma.contract.findFirst({ where: { id, partnerId }, include: contractInclude });
  if (!c) throw Errors.notFound("Contrato não encontrado");
  return decorateContract(c);
}

export type FinanceCtx = { partnerId: string; userId: string; membershipId: string; ip?: string };

/** Creates a DRAFT contract with items, pets and installments; optionally generates PACKAGE sessions in the agenda. */
export async function createContract(ctx: FinanceCtx, input: ContractInput) {
  const client = await prisma.client.findFirst({ where: { id: input.clientId, partnerId: ctx.partnerId, deletedAt: null }, select: { id: true } });
  if (!client) throw Errors.notFound("Cliente não encontrado");
  const petIds = [...new Set(input.petIds ?? [])];
  if (petIds.length) {
    const n = await prisma.pet.count({ where: { id: { in: petIds }, deletedAt: null, clients: { some: { clientId: client.id } } } });
    if (n !== petIds.length) throw Errors.badRequest("Um ou mais pets não pertencem a este cliente");
  }
  for (const it of input.items) {
    if (it.itemId) {
      const item = await prisma.catalogItem.findFirst({ where: { id: it.itemId, partnerId: ctx.partnerId, deletedAt: null }, select: { id: true } });
      if (!item) throw Errors.notFound("Item do catálogo não encontrado");
    }
  }

  const { totalCents, discountCents, netCents } = contractTotals(input.items, input.discount ?? 0);
  const parts = splitInstallments(netCents, input.installmentsCount);
  const dues = installmentDueDates(input.firstDueDate, input.periodicity, input.installmentsCount);

  const contract = await prisma.contract.create({
    data: {
      partnerId: ctx.partnerId,
      clientId: client.id,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      totalAmount: fromCents(totalCents),
      discount: fromCents(discountCents),
      installmentsCount: input.installmentsCount,
      firstDueDate: dateOnly(input.firstDueDate),
      periodicity: input.periodicity,
      sessionsCount: input.sessionsCount ?? null,
      terms: input.terms ?? null,
      status: "DRAFT",
      items: { create: input.items.map((it) => ({ itemId: it.itemId ?? null, description: it.description, quantity: it.quantity, unitPrice: it.unitPrice })) },
      pets: { create: petIds.map((petId) => ({ petId })) },
      installments: { create: parts.map((cents, i) => ({ number: i + 1, dueDate: dues[i]!, amount: fromCents(cents) })) },
    },
    include: contractInclude,
  });

  if (input.generateAppointments && input.type === "PACKAGE" && input.sessionsCount) {
    const g = input.generateAppointments;
    try {
      await createAppointments(
        { partnerId: ctx.partnerId, userId: ctx.userId, membershipId: ctx.membershipId, byPartner: true },
        {
          clientId: client.id,
          petIds,
          itemId: g.itemId ?? input.items.find((i) => i.itemId)?.itemId ?? null,
          membershipId: g.membershipId ?? null,
          title: input.title,
          startsAt: g.startsAt,
          durationMinutes: g.durationMinutes,
          locationType: g.locationType,
          addressId: g.addressId ?? null,
          recurrence: "PACKAGE",
          occurrences: input.sessionsCount,
          packageCadence: g.recurrence,
          contractId: contract.id,
          status: "CONFIRMED",
        },
      );
    } catch (e) {
      await prisma.contract.delete({ where: { id: contract.id } });
      throw e;
    }
  }

  await audit({ userId: ctx.userId, partnerId: ctx.partnerId, action: "contract.create", entity: "Contract", entityId: contract.id, data: { totalCents, discountCents, installments: parts }, ip: ctx.ip });
  return getContract(ctx.partnerId, contract.id);
}

const updatableContractFields = ["title", "description", "terms", "sessionsCount"] as const;

export async function updateContract(ctx: FinanceCtx, id: string, patch: Partial<Pick<ContractInput, "title" | "description" | "terms" | "sessionsCount" | "petIds">>) {
  const c = await prisma.contract.findFirst({ where: { id, partnerId: ctx.partnerId }, select: { id: true, status: true, clientId: true, acceptedAt: true } });
  if (!c) throw Errors.notFound("Contrato não encontrado");
  if (c.status === "CANCELED") throw Errors.badRequest("Contrato cancelado não pode ser alterado");
  const data: Prisma.ContractUpdateInput = {};
  for (const k of updatableContractFields) if (patch[k] !== undefined) (data as Record<string, unknown>)[k] = patch[k];
  const changed = [...Object.keys(data), ...(patch.petIds !== undefined ? ["petIds"] : [])];
  // after the tutor accepted, the content is frozen (status transitions go through setContractStatus)
  if (c.acceptedAt && changed.length) throw Errors.conflict("Contrato já aceito: crie um aditivo ou novo contrato");
  await prisma.$transaction(async (tx) => {
    await tx.contract.update({ where: { id }, data });
    if (patch.petIds) {
      const petIds = [...new Set(patch.petIds)];
      const n = await tx.pet.count({ where: { id: { in: petIds }, deletedAt: null, clients: { some: { clientId: c.clientId } } } });
      if (n !== petIds.length) throw Errors.badRequest("Um ou mais pets não pertencem a este cliente");
      await tx.contractPet.deleteMany({ where: { contractId: id } });
      await tx.contractPet.createMany({ data: petIds.map((petId) => ({ contractId: id, petId })) });
    }
  });
  await audit({ userId: ctx.userId, partnerId: ctx.partnerId, action: "contract.update", entity: "Contract", entityId: id, data: { fields: changed, ...data, ...(patch.petIds ? { petIds: patch.petIds } : {}) }, ip: ctx.ip });
  return getContract(ctx.partnerId, id);
}

const CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELED"],
  ACTIVE: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
};

export async function setContractStatus(ctx: FinanceCtx, id: string, status: ContractStatus) {
  const c = await prisma.contract.findFirst({ where: { id, partnerId: ctx.partnerId }, include: { client: { select: { userId: true, name: true } } } });
  if (!c) throw Errors.notFound("Contrato não encontrado");
  if (!CONTRACT_TRANSITIONS[c.status].includes(status)) throw Errors.badRequest(`Transição inválida: ${c.status} → ${status}`);
  if (status === "ACTIVE") {
    const active = await prisma.contract.count({ where: { partnerId: ctx.partnerId, status: "ACTIVE" } });
    await assertLimit("PARTNER", ctx.partnerId, "active_contracts", active);
  }
  await prisma.$transaction(async (tx) => {
    await tx.contract.update({ where: { id }, data: { status } });
    if (status === "CANCELED") {
      await tx.installment.updateMany({ where: { contractId: id, status: { in: ["PENDING", "OVERDUE"] } }, data: { status: "CANCELED" } });
      await tx.appointment.updateMany({ where: { contractId: id, status: { in: ["REQUESTED", "CONFIRMED"] }, startsAt: { gt: new Date() } }, data: { status: "CANCELED", cancelReason: "Contrato cancelado", canceledBy: "PARTNER" } });
    }
  });
  await audit({ userId: ctx.userId, partnerId: ctx.partnerId, action: `contract.${status.toLowerCase()}`, entity: "Contract", entityId: id, ip: ctx.ip });
  if (status === "ACTIVE" && c.client.userId) {
    await notify({ userId: c.client.userId, type: "contract.active", title: "Novo contrato", body: `O contrato "${c.title}" está ativo. Você pode revisar e aceitar os termos no app.`, data: { contractId: id }, email: true });
  }
  return getContract(ctx.partnerId, id);
}

// ───────────────────────────── installments & payments ─────────────────────────────

export const installmentInclude = {
  payments: { orderBy: { paidAt: "asc" as const } },
  contract: { select: { id: true, title: true, type: true, status: true, clientId: true, client: { select: { id: true, name: true, userId: true } }, partner: { select: { id: true, tradeName: true } } } },
} satisfies Prisma.InstallmentInclude;

export async function listInstallments(partnerId: string, q: { status?: InstallmentStatus; from?: string; to?: string; clientId?: string }) {
  return prisma.installment.findMany({
    where: {
      contract: { partnerId, ...(q.clientId ? { clientId: q.clientId } : {}) },
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to ? { dueDate: { ...(q.from ? { gte: dateOnly(q.from) } : {}), ...(q.to ? { lte: dateOnly(q.to) } : {}) } } : {}),
    },
    include: installmentInclude,
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
  });
}

async function installmentOrThrow(partnerId: string, id: string) {
  const i = await prisma.installment.findFirst({ where: { id, contract: { partnerId } }, include: installmentInclude });
  if (!i) throw Errors.notFound("Parcela não encontrada");
  return i;
}

function statusAfterPayment(amountCents: number, paidCents: number, dueDate: Date): InstallmentStatus {
  if (paidCents >= amountCents) return "PAID";
  return daysLate(dueDate) > 0 ? "OVERDUE" : "PENDING";
}

export async function addPayment(ctx: FinanceCtx, installmentId: string, input: { paidAt: string; amount: number; method: Prisma.PaymentCreateInput["method"]; receiptUrl?: string | null; notes?: string | null }) {
  const inst = await installmentOrThrow(ctx.partnerId, installmentId);
  if (inst.status === "CANCELED") throw Errors.badRequest("Parcela cancelada");
  if (inst.status === "PAID") throw Errors.badRequest("Parcela já quitada");
  const paidCents = toCents(inst.paidAmount) + toCents(input.amount);
  const status = statusAfterPayment(toCents(inst.amount), paidCents, inst.dueDate);
  const [payment] = await prisma.$transaction([
    prisma.payment.create({ data: { installmentId, paidAt: dateOnly(input.paidAt), amount: input.amount, method: input.method, receiptUrl: input.receiptUrl ?? null, notes: input.notes ?? null } }),
    prisma.installment.update({ where: { id: installmentId }, data: { paidAmount: fromCents(paidCents), status } }),
  ]);
  await audit({ userId: ctx.userId, partnerId: ctx.partnerId, action: "payment.create", entity: "Payment", entityId: payment.id, data: { installmentId, amount: input.amount, method: input.method, status }, ip: ctx.ip });
  if (inst.contract.client.userId) {
    await notify({ userId: inst.contract.client.userId, type: "payment.received", title: "Pagamento registrado", body: `${inst.contract.partner.tradeName} registrou ${formatBRL(input.amount)} na parcela ${inst.number} de "${inst.contract.title}".`, data: { installmentId } });
  }
  return installmentOrThrow(ctx.partnerId, installmentId);
}

export async function deletePayment(ctx: FinanceCtx, paymentId: string) {
  const p = await prisma.payment.findFirst({ where: { id: paymentId, installment: { contract: { partnerId: ctx.partnerId } } }, include: { installment: true } });
  if (!p) throw Errors.notFound("Pagamento não encontrado");
  const paidCents = Math.max(0, toCents(p.installment.paidAmount) - toCents(p.amount));
  const status = p.installment.status === "CANCELED" ? "CANCELED" : statusAfterPayment(toCents(p.installment.amount), paidCents, p.installment.dueDate);
  await prisma.$transaction([prisma.payment.delete({ where: { id: paymentId } }), prisma.installment.update({ where: { id: p.installmentId }, data: { paidAmount: fromCents(paidCents), status } })]);
  await audit({ userId: ctx.userId, partnerId: ctx.partnerId, action: "payment.delete", entity: "Payment", entityId: paymentId, data: { installmentId: p.installmentId, amount: Number(p.amount) }, ip: ctx.ip });
  return installmentOrThrow(ctx.partnerId, p.installmentId);
}

export async function remindInstallment(ctx: FinanceCtx, installmentId: string) {
  const inst = await installmentOrThrow(ctx.partnerId, installmentId);
  if (inst.status === "PAID" || inst.status === "CANCELED") throw Errors.badRequest("Parcela já encerrada");
  const userId = inst.contract.client.userId;
  if (!userId) throw Errors.badRequest("O cliente ainda não tem conta no tinyPet; envie o lembrete por outro canal");
  const late = daysLate(inst.dueDate);
  const remaining = fromCents(toCents(inst.amount) - toCents(inst.paidAmount));
  await notify({
    userId,
    type: "installment.reminder",
    title: late ? "Parcela em atraso" : "Lembrete de vencimento",
    body: `Parcela ${inst.number} de "${inst.contract.title}" (${inst.contract.partner.tradeName}): ${formatBRL(remaining)} ${late ? `vencida há ${late} dia(s)` : `vence em ${formatDateBR(inst.dueDate)}`}.`,
    data: { installmentId, contractId: inst.contractId },
    email: true,
  });
  await prisma.installment.update({ where: { id: installmentId }, data: { reminderSentAt: new Date() } });
  return { sent: true };
}

// ───────────────────────────── transactions ─────────────────────────────

export async function listTransactions(partnerId: string, q: { from?: string; to?: string; kind?: "INCOME" | "EXPENSE" }) {
  return prisma.transaction.findMany({
    where: { partnerId, ...(q.kind ? { kind: q.kind } : {}), ...(q.from || q.to ? { occurredAt: { ...(q.from ? { gte: dateOnly(q.from) } : {}), ...(q.to ? { lte: dateOnly(q.to) } : {}) } } : {}) },
    orderBy: { occurredAt: "desc" },
  });
}

// ───────────────────────────── summary ─────────────────────────────

export async function financeSummary(partnerId: string, q: { from?: string; to?: string }) {
  const today = dateOnly(localDateStr(new Date()));
  const from = q.from ? dateOnly(q.from) : today;
  const to = q.to ? dateOnly(q.to) : addDays(today, 30);
  const histFrom = q.from ? dateOnly(q.from) : addMonths(dateOnly(`${localDateStr(new Date()).slice(0, 7)}-01`), -11);
  const histTo = q.to ? dateOnly(q.to) : addDays(today, 1);

  const [receivableRows, overdueRows, payments, transactions] = await Promise.all([
    prisma.installment.findMany({ where: { contract: { partnerId }, status: { in: ["PENDING", "OVERDUE"] }, dueDate: { gte: from, lte: to } }, select: { amount: true, paidAmount: true } }),
    prisma.installment.findMany({
      where: { contract: { partnerId }, OR: [{ status: "OVERDUE" }, { status: "PENDING", dueDate: { lt: today } }] },
      include: { contract: { select: { id: true, title: true, client: { select: { id: true, name: true, userId: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.payment.findMany({
      where: { installment: { contract: { partnerId } }, paidAt: { gte: histFrom, lte: histTo } },
      include: { installment: { select: { contract: { select: { items: { take: 1, select: { description: true, item: { select: { name: true } } } } } } } } },
    }),
    prisma.transaction.findMany({ where: { partnerId, occurredAt: { gte: histFrom, lte: histTo } } }),
  ]);

  const receivableCents = receivableRows.reduce((s, r) => s + toCents(r.amount) - toCents(r.paidAmount), 0);
  const overdue = overdueRows.map((r) => ({
    id: r.id,
    contractId: r.contract.id,
    contractTitle: r.contract.title,
    clientId: r.contract.client.id,
    clientName: r.contract.client.name,
    hasAccount: !!r.contract.client.userId,
    number: r.number,
    dueDate: r.dueDate,
    amount: Number(r.amount),
    paidAmount: Number(r.paidAmount),
    remaining: fromCents(toCents(r.amount) - toCents(r.paidAmount)),
    daysLate: daysLate(r.dueDate),
    reminderSentAt: r.reminderSentAt,
  }));

  const byMonth = new Map<string, number>();
  const byMethod = new Map<string, number>();
  const byService = new Map<string, number>();
  const cash = new Map<string, { income: number; expense: number }>();
  const cashFor = (k: string) => cash.get(k) ?? (cash.set(k, { income: 0, expense: 0 }), cash.get(k)!);
  for (const p of payments) {
    const cents = toCents(p.amount);
    const mk = monthKey(p.paidAt);
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + cents);
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + cents);
    const first = p.installment.contract.items[0];
    const service = first?.item?.name ?? first?.description ?? "Outros";
    byService.set(service, (byService.get(service) ?? 0) + cents);
    cashFor(mk).income += cents;
  }
  for (const t of transactions) {
    const mk = monthKey(t.occurredAt);
    const cents = toCents(t.amount);
    if (t.kind === "INCOME") cashFor(mk).income += cents;
    else cashFor(mk).expense += cents;
  }
  const sortKeys = (m: Map<string, unknown>) => [...m.keys()].sort();

  return {
    period: { from, to },
    receivable: { total: fromCents(receivableCents), count: receivableRows.length, from, to },
    overdue,
    overdueTotal: fromCents(overdue.reduce((s, o) => s + toCents(o.remaining), 0)),
    receivedByMonth: sortKeys(byMonth).map((month) => ({ month, total: fromCents(byMonth.get(month)!) })),
    receivedByMethod: [...byMethod.entries()].map(([method, cents]) => ({ method, label: PAYMENT_METHOD_LABEL[method as keyof typeof PAYMENT_METHOD_LABEL] ?? method, total: fromCents(cents) })).sort((a, b) => b.total - a.total),
    receivedByService: [...byService.entries()].map(([service, cents]) => ({ service, total: fromCents(cents) })).sort((a, b) => b.total - a.total),
    cashflow: sortKeys(cash).map((month) => {
      const c = cash.get(month)!;
      return { month, income: fromCents(c.income), expense: fromCents(c.expense), net: fromCents(c.income - c.expense) };
    }),
  };
}

// ───────────────────────────── export ─────────────────────────────

export async function exportCsv(partnerId: string, type: "installments" | "transactions", q: { from?: string; to?: string }) {
  if (type === "installments") {
    const rows = await listInstallments(partnerId, q);
    return toCsv(
      ["Contrato", "Cliente", "Parcela", "Vencimento", "Valor", "Pago", "Saldo", "Status", "Pagamentos"],
      rows.map((r) => [
        r.contract.title,
        r.contract.client.name,
        r.number,
        r.dueDate,
        Number(r.amount),
        Number(r.paidAmount),
        fromCents(toCents(r.amount) - toCents(r.paidAmount)),
        INSTALLMENT_STATUS_LABEL[r.status],
        r.payments.map((p) => `${formatDateBR(p.paidAt)} ${formatNumberBR(Number(p.amount))} ${PAYMENT_METHOD_LABEL[p.method]}`).join(" | "),
      ]),
    );
  }
  const rows = await listTransactions(partnerId, q);
  return toCsv(
    ["Data", "Tipo", "Categoria", "Descrição", "Valor", "Forma"],
    rows.map((t) => [t.occurredAt, t.kind === "INCOME" ? "Receita" : "Despesa", t.category, t.description ?? "", Number(t.amount), t.method ? PAYMENT_METHOD_LABEL[t.method] : ""]),
  );
}

// ───────────────────────────── printable contract ─────────────────────────────

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function contractHtml(contractId: string, scope: { partnerId?: string; userId?: string }) {
  const c = await prisma.contract.findFirst({
    where: { id: contractId, ...(scope.partnerId ? { partnerId: scope.partnerId } : {}), ...(scope.userId ? { client: { userId: scope.userId }, ...ownerVisibleContract } : {}) },
    include: { ...contractInclude, partner: { select: { tradeName: true, legalName: true, document: true, documentType: true, addresses: { orderBy: { isPrimary: "desc" }, take: 1 } } } },
  });
  if (!c) throw Errors.notFound("Contrato não encontrado");
  const d = decorateContract(c);
  const addr = c.partner.addresses[0];
  const addressLine = addr ? [addr.street, addr.number, addr.district, `${addr.city}/${addr.state}`, addr.zipCode].filter(Boolean).join(", ") : "";
  const itemsRows = c.items.map((it) => `<tr><td>${esc(it.item?.name ?? it.description)}</td><td class="r">${it.quantity}</td><td class="r">${formatBRL(Number(it.unitPrice))}</td><td class="r">${formatBRL(it.quantity * Number(it.unitPrice))}</td></tr>`).join("");
  const instRows = c.installments.map((i) => `<tr><td>${i.number}/${c.installmentsCount}</td><td>${formatDateBR(i.dueDate)}</td><td class="r">${formatBRL(Number(i.amount))}</td><td class="r">${formatBRL(Number(i.paidAmount))}</td><td>${INSTALLMENT_STATUS_LABEL[i.status]}</td></tr>`).join("");
  const acceptance = c.acceptedAt ? `<p><strong>Aceito pelo cliente em ${formatLocal(c.acceptedAt)}</strong> (IP ${esc(c.acceptedIp)}).</p>` : `<p class="muted">Aguardando aceite do cliente pelo aplicativo.</p>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato — ${esc(c.title)}</title>
<style>body{font-family:Inter,Arial,sans-serif;color:#242833;max-width:800px;margin:32px auto;padding:0 24px;font-size:14px;line-height:1.5}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:24px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left}th{background:#f8f9fb}.r{text-align:right}.muted{color:#8792a8}.brand{color:#f95d16;font-weight:700}.terms{white-space:pre-wrap;background:#fafafa;border:1px solid #eee;padding:12px;border-radius:6px}@media print{body{margin:0}.noprint{display:none}}</style></head><body>
<p class="brand">tinyPet</p>
<h1>${esc(c.title)}</h1>
<p class="muted">Contrato ${esc(c.id)} · ${esc(c.type)} · Status: ${esc(c.status)} · Emitido em ${formatLocal(c.createdAt)}</p>
<h2>Partes</h2>
<p><strong>Prestador:</strong> ${esc(c.partner.legalName ?? c.partner.tradeName)}${c.partner.legalName ? ` (${esc(c.partner.tradeName)})` : ""}${c.partner.document ? ` · ${esc(c.partner.documentType)} ${esc(c.partner.document)}` : ""}${addressLine ? `<br>${esc(addressLine)}` : ""}</p>
<p><strong>Cliente:</strong> ${esc(c.client.name)}${d.pets.length ? `<br><strong>Pet(s):</strong> ${esc(d.pets.map((p) => p.name).join(", "))}` : ""}</p>
${c.description ? `<h2>Descrição</h2><p>${esc(c.description)}</p>` : ""}
<h2>Itens</h2>
<table><thead><tr><th>Descrição</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Total</th></tr></thead><tbody>${itemsRows}</tbody>
<tfoot><tr><td colspan="3" class="r">Subtotal</td><td class="r">${formatBRL(Number(c.totalAmount))}</td></tr>${Number(c.discount) ? `<tr><td colspan="3" class="r">Desconto</td><td class="r">− ${formatBRL(Number(c.discount))}</td></tr>` : ""}<tr><td colspan="3" class="r"><strong>Total</strong></td><td class="r"><strong>${formatBRL(d.netAmount)}</strong></td></tr></tfoot></table>
<h2>Parcelas</h2>
<table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="r">Valor</th><th class="r">Pago</th><th>Status</th></tr></thead><tbody>${instRows}</tbody></table>
${c.sessionsCount ? `<p><strong>Sessões:</strong> ${c.sessionsCount}</p>` : ""}
<h2>Termos</h2>
<div class="terms">${esc(c.terms) || "<span class=\"muted\">Sem termos adicionais.</span>"}</div>
<h2>Aceite</h2>
${acceptance}
<p class="noprint muted"><button onclick="window.print()">Imprimir / salvar em PDF</button></p>
</body></html>`;
}

// ───────────────────────────── owner side ─────────────────────────────

export const ownerContractInclude = {
  ...contractInclude,
  partner: { select: { id: true, tradeName: true, slug: true, logoUrl: true } },
} satisfies Prisma.ContractInclude;

/** Owners see non-draft contracts, and DRAFT ones only once the partner has written the terms (sent for acceptance). */
export const ownerVisibleContract = { OR: [{ status: { not: "DRAFT" } }, { terms: { not: null } }] } satisfies Prisma.ContractWhereInput;

export async function listOwnerContracts(userId: string) {
  const rows = await prisma.contract.findMany({ where: { client: { userId }, ...ownerVisibleContract }, include: ownerContractInclude, orderBy: { createdAt: "desc" } });
  return rows.map((c) => ({ ...decorateContract(c), partner: c.partner }));
}

export async function getOwnerContract(userId: string, id: string) {
  const c = await prisma.contract.findFirst({ where: { id, client: { userId }, ...ownerVisibleContract }, include: ownerContractInclude });
  if (!c) throw Errors.notFound("Contrato não encontrado");
  return { ...decorateContract(c), partner: c.partner };
}

export async function acceptContract(user: { id: string; name: string }, id: string, ip: string) {
  const c = await prisma.contract.findFirst({
    where: { id, client: { userId: user.id }, ...ownerVisibleContract },
    select: {
      id: true,
      status: true,
      acceptedAt: true,
      partnerId: true,
      title: true,
      description: true,
      terms: true,
      totalAmount: true,
      discount: true,
      sessionsCount: true,
      installments: { select: { number: true, dueDate: true, amount: true }, orderBy: { number: "asc" } },
    },
  });
  if (!c) throw Errors.notFound("Contrato não encontrado");
  if (c.status === "CANCELED") throw Errors.badRequest("Contrato cancelado");
  if (c.acceptedAt) return getOwnerContract(user.id, id);
  const { count } = await prisma.contract.updateMany({ where: { id, acceptedAt: null }, data: { acceptedAt: new Date(), acceptedIp: ip } });
  if (!count) return getOwnerContract(user.id, id);
  // durable record of exactly what was accepted
  await audit({
    userId: user.id,
    partnerId: c.partnerId,
    action: "contract.accept",
    entity: "Contract",
    entityId: id,
    ip,
    data: {
      title: c.title,
      description: c.description,
      terms: c.terms,
      totalAmount: Number(c.totalAmount),
      discount: Number(c.discount),
      sessionsCount: c.sessionsCount,
      installments: c.installments.map((i) => ({ number: i.number, dueDate: i.dueDate.toISOString().slice(0, 10), amount: Number(i.amount) })),
    },
  });
  await notifyPartner(c.partnerId, { type: "contract.accepted", title: "Contrato aceito", body: `${user.name} aceitou o contrato "${c.title}".`, data: { contractId: id } });
  return getOwnerContract(user.id, id);
}

export async function listOwnerInstallments(userId: string, status?: InstallmentStatus) {
  return prisma.installment.findMany({
    where: { contract: { client: { userId }, status: { not: "DRAFT" } }, ...(status ? { status } : {}) },
    include: installmentInclude,
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
  });
}
