import { addMonths, addWeeks, format, parseISO } from "date-fns";

/** Splits `total` into `count` installments (2 decimals); the last one absorbs rounding. */
export function splitInstallmentsPreview(total: number, count: number, firstDueDate: string, periodicity: "WEEKLY" | "BIWEEKLY" | "MONTHLY") {
  const n = Math.max(1, Math.floor(count || 1));
  const cents = Math.round(Math.max(0, total) * 100);
  // same split as the API (src/server/finance.ts splitInstallments): round, last absorbs; floor when the last would go negative
  let base = Math.round(cents / n);
  if (cents - base * (n - 1) < 0) base = Math.floor(cents / n);
  const first = /^\d{4}-\d{2}-\d{2}$/.test(firstDueDate) ? parseISO(`${firstDueDate}T12:00:00`) : null;
  return Array.from({ length: n }, (_, i) => {
    const amountCents = i === n - 1 ? cents - base * (n - 1) : base;
    const due = first ? (periodicity === "MONTHLY" ? addMonths(first, i) : addWeeks(first, periodicity === "BIWEEKLY" ? i * 2 : i)) : null;
    return { number: i + 1, amount: amountCents / 100, dueDate: due ? format(due, "yyyy-MM-dd") : "" };
  });
}
