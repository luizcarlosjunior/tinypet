import { prisma } from "@tinypet/db";
import { formatBRL } from "@tinypet/shared";
import { notify } from "@/server";
import { cronRoute } from "@/server/jobs";
import { formatLocal, localDateStr } from "@/server/scheduling";
import { dateOnly, formatDateBR, fromCents, toCents } from "@/server/finance";

/**
 * GET|POST /jobs/reminders (Authorization: Bearer CRON_SECRET or x-cron-secret) → appointment reminders 24h/2h before (CONFIRMED) and
 * installment "due tomorrow" reminders to owners with an account.
 */
async function jobReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3_600_000);
  const in2h = new Date(now.getTime() + 2 * 3_600_000);
  const include = { client: { select: { userId: true } }, partner: { select: { tradeName: true } }, item: { select: { name: true } } } as const;

  const [due24, due2] = await Promise.all([
    prisma.appointment.findMany({ where: { status: "CONFIRMED", reminder24hSentAt: null, startsAt: { gt: now, lte: in24h } }, include }),
    prisma.appointment.findMany({ where: { status: "CONFIRMED", reminder2hSentAt: null, startsAt: { gt: now, lte: in2h } }, include }),
  ]);

  let sent24 = 0;
  for (const a of due24) {
    const userId = a.client?.userId ?? a.requestedByUserId;
    if (userId) {
      await notify({ userId, type: "appointment.reminder", title: "Lembrete: atendimento amanhã", body: `${a.title ?? a.item?.name ?? "Atendimento"} com ${a.partner.tradeName} em ${formatLocal(a.startsAt)}.`, data: { appointmentId: a.id, kind: "24h" }, email: true });
      sent24++;
    }
    await prisma.appointment.update({ where: { id: a.id }, data: { reminder24hSentAt: now } });
  }
  let sent2 = 0;
  for (const a of due2) {
    const userId = a.client?.userId ?? a.requestedByUserId;
    if (userId) {
      await notify({ userId, type: "appointment.reminder", title: "Lembrete: atendimento em breve", body: `${a.title ?? a.item?.name ?? "Atendimento"} com ${a.partner.tradeName} às ${formatLocal(a.startsAt, "HH:mm")}.`, data: { appointmentId: a.id, kind: "2h" }, email: true });
      sent2++;
    }
    await prisma.appointment.update({ where: { id: a.id }, data: { reminder2hSentAt: now } });
  }

  const tomorrow = dateOnly(localDateStr(new Date(now.getTime() + 86_400_000)));
  const installments = await prisma.installment.findMany({
    where: { status: "PENDING", reminderSentAt: null, dueDate: tomorrow, contract: { status: "ACTIVE", client: { userId: { not: null } } } },
    include: { contract: { select: { title: true, client: { select: { userId: true } }, partner: { select: { tradeName: true } } } } },
  });
  let sentInstallments = 0;
  for (const i of installments) {
    const userId = i.contract.client.userId!;
    const remaining = fromCents(toCents(i.amount) - toCents(i.paidAmount));
    await notify({ userId, type: "installment.reminder", title: "Parcela vence amanhã", body: `Parcela ${i.number} de "${i.contract.title}" (${i.contract.partner.tradeName}): ${formatBRL(remaining)} vence em ${formatDateBR(i.dueDate)}.`, data: { installmentId: i.id, contractId: i.contractId }, email: true });
    await prisma.installment.update({ where: { id: i.id }, data: { reminderSentAt: now } });
    sentInstallments++;
  }

  return { appointments24h: sent24, appointments2h: sent2, installments: sentInstallments, ranAt: now };
}

export const { GET, POST } = cronRoute(jobReminders);

/** Never statically cached: must run on every cron hit. */
export const dynamic = "force-dynamic";
